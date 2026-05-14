import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { buildCodexUserInputItems } from '../context'
import { createAgentChatDiagnostic } from '../diagnostics'
import type { AgentChatProcessRunner } from '../host'
import type {
  AgentChatCapabilityReport,
  AgentChatContextManifest,
  AgentChatEngineAdapter,
  AgentChatEngineEvent,
  AgentChatEngineResumeInput,
  AgentChatEngineSendInput,
  AgentChatEngineStartInput,
  AgentChatEngineStopInput,
  AgentChatNativeSession
} from '../types'
import {
  createCodexAppServerClient,
  createCodexNotificationMapper,
  type CodexAppServerClient
} from './codexAppServerClient'
import type { CodexThread } from './protocolTypes'

export interface CodexAgentChatAdapterOptions {
  readonly command?: string
  readonly now?: () => string
  readonly processRunner: AgentChatProcessRunner
}

const REQUIRED_PROTOCOL_MARKERS = [
  'initialize',
  'initialized',
  'thread/start',
  'thread/resume',
  'thread/list',
  'turn/start',
  'turn/interrupt',
  'localImage',
  'cwd',
  'approvalPolicy',
  'sandbox'
] as const
const CODEX_GENERATE_TS_PROBE_TIMEOUT_MS = 30_000

const now = (): string => new Date().toISOString()

const createUnsupportedReport = (
  details?: string,
  code: 'authentication-required' | 'protocol-unsupported' = 'protocol-unsupported'
): AgentChatCapabilityReport => ({
  authenticated: code === 'authentication-required' ? false : undefined,
  diagnostic: createAgentChatDiagnostic({
    code,
    details,
    recoverable: false
  }),
  engineId: 'codex',
  verdict: 'unsupported'
})

const readGeneratedProtocolSource = async (directory: string): Promise<string> => {
  const parts: string[] = []
  const visit = async (currentDirectory: string): Promise<void> => {
    for (const entry of await readdir(currentDirectory, { withFileTypes: true })) {
      const path = join(currentDirectory, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        parts.push(await readFile(path, 'utf8'))
      }
    }
  }

  await visit(directory)
  return parts.join('\n')
}

const hasRequiredProtocol = (source: string): boolean =>
  REQUIRED_PROTOCOL_MARKERS.every((marker) => source.includes(marker))

const isLoggedIn = (stdout: string): boolean =>
  /^logged in\b/iu.test(stdout.trim())

const probeCodexLoginStatus = async (
  options: CodexAgentChatAdapterOptions,
  command: string
): Promise<void> => {
  const status = await options.processRunner.execFile(command, ['login', 'status'])

  if (!isLoggedIn(status.stdout)) {
    throw new Error(status.stdout.trim() || 'Codex is not logged in')
  }
}

const createClient = (
  options: CodexAgentChatAdapterOptions
): CodexAppServerClient => {
  const command = options.command ?? 'codex'
  return createCodexAppServerClient({
    child: options.processRunner.spawn(command, ['app-server', '--listen', 'stdio://'])
  })
}

const modelParams = (modelName?: string): { readonly model?: string } =>
  modelName ? { model: modelName } : {}

const mapThread = (thread: CodexThread): AgentChatNativeSession => ({
  cwd: thread.cwd,
  nativeSessionId: thread.id,
  title: thread.name ?? thread.preview,
  updatedAt: thread.updatedAt ? new Date(thread.updatedAt * 1000).toISOString() : undefined
})

const getTimestamp = (
  timestampSeconds: number | null | undefined,
  nowProvider: () => string
): string =>
  typeof timestampSeconds === 'number' && Number.isFinite(timestampSeconds)
    ? new Date(timestampSeconds * 1000).toISOString()
    : nowProvider()

interface CodexTextContent {
  readonly text?: string
  readonly type: string
}

const isCodexTextContent = (item: unknown): item is CodexTextContent =>
  typeof item === 'object' &&
  item !== null &&
  'type' in item &&
  typeof (item as { readonly type?: unknown }).type === 'string'

const getStringItems = (value: readonly unknown[] | undefined): readonly string[] =>
  (value ?? []).filter((item): item is string => typeof item === 'string')

const getHistoryUserContent = (
  content: readonly CodexTextContent[]
): string => {
  const text = content
    .filter((item) => item.type === 'text')
    .map((item) => item.text ?? '')
    .join('\n\n')
    .trim()

  if (!text) {
    return ''
  }

  const separatedMarker = '\n\nUser message:\n'
  const separatedMarkerIndex = text.lastIndexOf(separatedMarker)
  if (separatedMarkerIndex >= 0) {
    return text.slice(separatedMarkerIndex + separatedMarker.length).trim()
  }

  const leadingMarker = 'User message:\n'
  if (text.startsWith(leadingMarker)) {
    return text.slice(leadingMarker.length).trim()
  }

  return text
}

const getHistoryReasoningContent = (input: {
  readonly content?: readonly unknown[]
  readonly summary?: readonly unknown[]
}): string =>
  [...getStringItems(input.summary), ...getStringItems(input.content)]
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n\n')

const createHistoryEvents = function* (
  thread: CodexThread,
  sessionId: string,
  nowProvider: () => string
): Iterable<AgentChatEngineEvent> {
  for (const turn of thread.turns ?? []) {
    const userCreatedAt = getTimestamp(turn.startedAt, nowProvider)
    const assistantCreatedAt = getTimestamp(
      turn.completedAt ?? turn.startedAt,
      nowProvider
    )

    for (const item of turn.items ?? []) {
      if (
        item.type === 'userMessage' &&
        typeof item.id === 'string' &&
        Array.isArray(item.content)
      ) {
        const content = getHistoryUserContent(
          item.content.filter(isCodexTextContent)
        )
        if (!content) {
          continue
        }
        yield {
          message: {
            attachments: [],
            content,
            createdAt: userCreatedAt,
            messageId: item.id,
            role: 'user',
            sessionId
          },
          type: 'message-created'
        }
        continue
      }

      if (item.type === 'reasoning' && typeof item.id === 'string') {
        const content = getHistoryReasoningContent(item)
        if (!content) {
          continue
        }
        yield {
          message: {
            attachments: [],
            content,
            createdAt: assistantCreatedAt,
            isStreaming: false,
            messageId: item.id,
            role: 'thinking',
            sessionId
          },
          type: 'thinking-updated'
        }
        continue
      }

      if (
        item.type === 'agentMessage' &&
        typeof item.id === 'string' &&
        typeof item.text === 'string' &&
        item.text.trim()
      ) {
        yield {
          message: {
            attachments: [],
            content: item.text,
            createdAt: assistantCreatedAt,
            messageId: item.id,
            role: 'assistant',
            sessionId
          },
          type: 'assistant-message-completed'
        }
      }
    }
  }
}

const getContextManifest = (
  input: AgentChatEngineStartInput | AgentChatEngineSendInput | AgentChatEngineResumeInput
): AgentChatContextManifest =>
  input.contextManifest ?? {
    currentDocumentSnapshot: '',
    permissionMode: 'max-permission',
    selectedBlockIds: [],
    selectedText: '',
    sessionPurpose: input.session.sessionPurpose,
    workspaceRoot: input.workspaceRoot
  }

const runTurn = async function* (
  client: CodexAppServerClient,
  input: AgentChatEngineStartInput | AgentChatEngineSendInput | AgentChatEngineResumeInput,
  nativeSessionId: string,
  nowProvider: () => string,
  onTurnStarted: (
    threadId: string,
    turnId: string,
    client: CodexAppServerClient
  ) => void,
  onTurnFinished: (threadId: string) => void
): AsyncIterable<AgentChatEngineEvent> {
  const mapper = createCodexNotificationMapper({
    now: nowProvider,
    sessionId: input.session.sessionId
  })
  type QueueItem =
    | { readonly event: AgentChatEngineEvent; readonly type: 'event' }
    | { readonly error: Error; readonly type: 'error' }
    | { readonly type: 'done' }
  const queuedItems: QueueItem[] = []
  const waitingConsumers: ((item: QueueItem) => void)[] = []
  const enqueue = (item: QueueItem): void => {
    const consumer = waitingConsumers.shift()
    if (consumer) {
      consumer(item)
      return
    }
    queuedItems.push(item)
  }
  const dequeue = (): Promise<QueueItem> => {
    const item = queuedItems.shift()
    if (item) {
      return Promise.resolve(item)
    }
    return new Promise((resolve) => {
      waitingConsumers.push(resolve)
    })
  }
  const unsubscribe = client.subscribeNotifications((notification) => {
    if (notification.method === 'turn/started') {
      onTurnStarted(notification.params.threadId, notification.params.turn.id, client)
    }

    for (const event of mapper.map(notification)) {
      enqueue({ event, type: 'event' })
    }

    if (notification.method === 'turn/completed') {
      onTurnFinished(notification.params.threadId)
      enqueue({ type: 'done' })
    }

    if (notification.method === 'error') {
      enqueue({
        error: new Error('Codex app-server turn failed'),
        type: 'error'
      })
    }
  })

  try {
    const attachments = 'attachments' in input ? input.attachments : []
    const contextManifest = getContextManifest(input)
    const response = await client.turnStart({
      approvalPolicy: 'never',
      cwd: input.workspaceRoot,
      input: buildCodexUserInputItems({
        attachments,
        content: input.content ?? '',
        contextManifest,
        sessionId: input.session.sessionId,
        workspaceRoot: input.workspaceRoot
      }),
      ...modelParams(input.modelName),
      sandboxPolicy: { type: 'dangerFullAccess' },
      threadId: nativeSessionId
    })
    onTurnStarted(nativeSessionId, response.turn.id, client)

    while (true) {
      const item = await dequeue()
      if (item.type === 'done') {
        return
      }
      if (item.type === 'error') {
        throw item.error
      }
      yield item.event
    }
  } finally {
    onTurnFinished(nativeSessionId)
    unsubscribe()
    client.close()
  }
}

export const createCodexAgentChatAdapter = (
  options: CodexAgentChatAdapterOptions
): AgentChatEngineAdapter => {
  const command = options.command ?? 'codex'
  const nowProvider = options.now ?? now
  const activeTurnByThread = new Map<
    string,
    {
      readonly client: CodexAppServerClient
      readonly turnId: string
    }
  >()
  const pendingInterruptByThread = new Set<string>()
  const interruptTurn = (
    threadId: string,
    activeTurn: {
      readonly client: CodexAppServerClient
      readonly turnId: string
    }
  ): void => {
    void activeTurn.client
      .turnInterrupt({
        threadId,
        turnId: activeTurn.turnId
      })
      .catch(() => undefined)
  }
  const rememberTurn = (
    threadId: string,
    turnId: string,
    client: CodexAppServerClient
  ): void => {
    const activeTurn = { client, turnId }
    activeTurnByThread.set(threadId, activeTurn)
    if (pendingInterruptByThread.has(threadId)) {
      pendingInterruptByThread.delete(threadId)
      interruptTurn(threadId, activeTurn)
    }
  }
  const forgetTurn = (threadId: string): void => {
    activeTurnByThread.delete(threadId)
    pendingInterruptByThread.delete(threadId)
  }

  return {
    createCapabilityCacheKey: async (): Promise<string | undefined> => {
      const version = await options.processRunner.execFile(command, ['--version'])
      try {
        const loginStatus = await options.processRunner.execFile(command, [
          'login',
          'status'
        ])

        return `${version.stdout.trim()}:${loginStatus.stdout.trim()}`
      } catch (error) {
        return `${version.stdout.trim()}:login-status-unavailable:${
          error instanceof Error ? error.message : 'unknown'
        }`
      }
    },
    engineId: 'codex',
    listNativeSessions: async (input) => {
      const client = createClient(options)
      try {
        const response = await client.threadList({
          cwd: input.workspaceRoot,
          limit: 50
        })
        return response.data.map(mapThread)
      } finally {
        client.close()
      }
    },
    probeCapabilities: async (): Promise<AgentChatCapabilityReport> => {
      let tempDirectory: string | undefined
      try {
        const version = await options.processRunner.execFile(command, ['--version'])
        try {
          await probeCodexLoginStatus(options, command)
        } catch (error) {
          return createUnsupportedReport(
            error instanceof Error ? error.message : 'Codex login status failed',
            'authentication-required'
          )
        }
        await options.processRunner.execFile(command, ['app-server', '--help'])
        tempDirectory = await mkdtemp(join(tmpdir(), 'mde-codex-app-server-types-'))
        let generatedStdout = ''
        let generateError: unknown
        try {
          const generated = await options.processRunner.execFile(
            command,
            [
              'app-server',
              'generate-ts',
              '--experimental',
              '--out',
              tempDirectory
            ],
            { timeoutMs: CODEX_GENERATE_TS_PROBE_TIMEOUT_MS }
          )
          generatedStdout = generated.stdout
        } catch (error) {
          generateError = error
        }
        const generatedSource = `${generatedStdout}\n${await readGeneratedProtocolSource(
          tempDirectory
        )}`

        if (!hasRequiredProtocol(generatedSource)) {
          return createUnsupportedReport(
            generateError instanceof Error
              ? generateError.message
              : 'Codex app-server protocol lacks required V1 chat fields'
          )
        }

        return {
          authenticated: true,
          engineId: 'codex',
          nativeVersion: version.stdout.trim(),
          verdict: 'supported'
        }
      } catch (error) {
        return createUnsupportedReport(
          error instanceof Error ? error.message : 'Codex app-server probe failed'
        )
      } finally {
        if (tempDirectory) {
          await rm(tempDirectory, { force: true, recursive: true })
        }
      }
    },
    resumeSession: async function* (
      input: AgentChatEngineResumeInput
    ): AsyncIterable<AgentChatEngineEvent> {
      const client = createClient(options)
      const response = await client.threadResume({
        approvalPolicy: 'never',
        cwd: input.workspaceRoot,
        excludeTurns: false,
        ...modelParams(input.modelName),
        persistExtendedHistory: false,
        sandbox: 'danger-full-access',
        threadId: input.nativeSessionId
      })
      const nativeSessionId = response.thread.id
      yield {
        nativeSessionId,
        sessionId: input.session.sessionId,
        ...(mapThread(response.thread).title
          ? { title: mapThread(response.thread).title }
          : {}),
        type: 'session-started'
      }
      yield* createHistoryEvents(response.thread, input.session.sessionId, nowProvider)

      if (input.content) {
        yield* runTurn(client, input, nativeSessionId, nowProvider, rememberTurn, forgetTurn)
      } else {
        client.close()
      }
    },
    sendMessage: async function* (
      input: AgentChatEngineSendInput
    ): AsyncIterable<AgentChatEngineEvent> {
      const client = createClient(options)
      yield* runTurn(client, input, input.nativeSessionId, nowProvider, rememberTurn, forgetTurn)
    },
    startSession: async function* (
      input: AgentChatEngineStartInput
    ): AsyncIterable<AgentChatEngineEvent> {
      const client = createClient(options)
      const response = await client.threadStart({
        approvalPolicy: 'never',
        cwd: input.workspaceRoot,
        developerInstructions: input.contextManifest.selectedText
          ? `Selected text:\n${input.contextManifest.selectedText}`
          : undefined,
        experimentalRawEvents: false,
        ...modelParams(input.modelName),
        persistExtendedHistory: false,
        sandbox: 'danger-full-access'
      })
      const nativeSessionId = response.thread.id
      yield {
        nativeSessionId,
        sessionId: input.session.sessionId,
        ...(mapThread(response.thread).title
          ? { title: mapThread(response.thread).title }
          : {}),
        type: 'session-started'
      }
      yield* runTurn(client, input, nativeSessionId, nowProvider, rememberTurn, forgetTurn)
    },
    stopSession: async function* (
      input: AgentChatEngineStopInput
    ): AsyncIterable<AgentChatEngineEvent> {
      const nativeSessionId = input.nativeSessionId
      const activeTurn = nativeSessionId
        ? activeTurnByThread.get(nativeSessionId)
        : undefined
      if (!nativeSessionId) {
        yield {
          diagnostic: createAgentChatDiagnostic({
            code: 'native-session-unavailable'
          }),
          sessionId: input.session.sessionId,
          type: 'diagnostic'
        }
        return
      }

      if (activeTurn) {
        await activeTurn.client.turnInterrupt({
          threadId: nativeSessionId,
          turnId: activeTurn.turnId
        })
      } else {
        pendingInterruptByThread.add(nativeSessionId)
      }
      yield {
        nativeSessionId,
        sessionId: input.session.sessionId,
        type: 'session-stopped'
      }
    }
  }
}
