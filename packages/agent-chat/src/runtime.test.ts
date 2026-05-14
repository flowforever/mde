import { describe, expect, it, vi } from 'vitest'

import { createFakeAgentChatAdapter } from './fakeAdapter'
import { createAgentChatRuntime } from './runtime'
import { createMemoryAgentChatMetadataStorage } from './storage'
import type {
  AgentChatEngineAdapter,
  AgentChatEngineEvent,
  AgentChatEvent,
  AgentChatWorkspaceFileSnapshot
} from './types'

const createTestFileStore = () => ({
  mkdir: vi.fn(() => Promise.resolve()),
  realpath: vi.fn((path: string) => Promise.resolve(path)),
  writeFile: vi.fn(() => Promise.resolve())
})

const createContextManifest = (workspaceRoot = '/workspace') => ({
  currentDocumentSnapshot: '# Example',
  permissionMode: 'max-permission' as const,
  selectedBlockIds: [],
  selectedText: '',
  sessionPurpose: 'document-chat' as const,
  workspaceRoot
})

const emptyEngineEvents = async function* (): AsyncIterable<AgentChatEngineEvent> {
  await Promise.resolve()
  yield* []
}

const createRecordingAdapter = (input: {
  readonly sendEvents?: readonly AgentChatEngineEvent[]
  readonly sendRejects?: Error
}): AgentChatEngineAdapter => ({
  engineId: 'codex',
  listNativeSessions: vi.fn(() => Promise.resolve([])),
  probeCapabilities: vi.fn(() =>
    Promise.resolve({
      engineId: 'codex' as const,
      verdict: 'supported' as const
    })
  ),
  resumeSession: vi.fn(() => emptyEngineEvents()),
  sendMessage: vi.fn(async function* () {
    await Promise.resolve()
    if (input.sendRejects) {
      throw input.sendRejects
    }

    for (const event of input.sendEvents ?? []) {
      yield event
    }
  }),
  startSession: vi.fn(async function* () {
    await Promise.resolve()
    if (input.sendRejects) {
      throw input.sendRejects
    }

    for (const event of input.sendEvents ?? []) {
      yield event
    }
  }),
  stopSession: vi.fn(() => emptyEngineEvents())
})

describe('createAgentChatRuntime', () => {
  it('deduplicates concurrent availability probes and reuses the cached result', async () => {
    let resolveProbe:
      | ((report: {
          readonly engineId: 'codex'
          readonly verdict: 'supported'
        }) => void)
      | undefined
    const probeCapabilities = vi.fn<AgentChatEngineAdapter['probeCapabilities']>(
      () =>
        new Promise((resolve) => {
          resolveProbe = resolve
        })
    )
    const adapter: AgentChatEngineAdapter = {
      ...createRecordingAdapter({}),
      probeCapabilities
    }
    const runtime = createAgentChatRuntime({
      adapters: [adapter],
      fileStore: createTestFileStore(),
      now: () => '2026-05-12T00:00:00.000Z'
    })
    const request = {
      selectedEngineId: 'codex' as const,
      workspaceRoot: '/workspace'
    }

    const firstAvailability = runtime.getAvailability(request)
    const secondAvailability = runtime.getAvailability(request)

    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(probeCapabilities).toHaveBeenCalledTimes(1)
    if (!resolveProbe) {
      throw new Error('Expected availability probe to start')
    }
    resolveProbe({
      engineId: 'codex',
      verdict: 'supported'
    })
    await expect(firstAvailability).resolves.toMatchObject({ available: true })
    await expect(secondAvailability).resolves.toMatchObject({ available: true })
    await expect(runtime.getAvailability(request)).resolves.toMatchObject({
      available: true
    })
    expect(probeCapabilities).toHaveBeenCalledTimes(1)
  })

  it('reuses a persisted availability report for the same engine identity', async () => {
    const metadataStorage = createMemoryAgentChatMetadataStorage()
    const firstProbeCapabilities = vi.fn<AgentChatEngineAdapter['probeCapabilities']>(
      () =>
        Promise.resolve({
          engineId: 'codex' as const,
          nativeVersion: 'codex-cli 0.130.0',
          verdict: 'supported'
        })
    )
    const createAdapter = (
      probeCapabilities: AgentChatEngineAdapter['probeCapabilities']
    ): AgentChatEngineAdapter => ({
      ...createRecordingAdapter({}),
      createCapabilityCacheKey: vi.fn(() =>
        Promise.resolve('codex-cli 0.130.0')
      ),
      probeCapabilities
    })
    const request = {
      selectedEngineId: 'codex' as const,
      workspaceRoot: '/workspace'
    }
    const firstRuntime = createAgentChatRuntime({
      adapters: [createAdapter(firstProbeCapabilities)],
      fileStore: createTestFileStore(),
      metadataStorage,
      now: () => '2026-05-12T00:00:00.000Z'
    })

    await expect(firstRuntime.getAvailability(request)).resolves.toMatchObject({
      available: true
    })

    const secondProbeCapabilities = vi.fn<AgentChatEngineAdapter['probeCapabilities']>(
      () => {
        throw new Error('full probe should not run')
      }
    )
    const secondRuntime = createAgentChatRuntime({
      adapters: [createAdapter(secondProbeCapabilities)],
      fileStore: createTestFileStore(),
      metadataStorage,
      now: () => '2026-05-12T00:00:01.000Z'
    })

    await expect(secondRuntime.getAvailability(request)).resolves.toMatchObject({
      available: true
    })
    expect(secondProbeCapabilities).not.toHaveBeenCalled()
  })

  it('hides availability when selected engine is not registered', async () => {
    const runtime = createAgentChatRuntime({
      adapters: [createFakeAgentChatAdapter({ engineId: 'codex' })],
      fileStore: createTestFileStore(),
      now: () => '2026-05-12T00:00:00.000Z'
    })

    await expect(
      runtime.getAvailability({
        selectedEngineId: 'claude',
        workspaceRoot: '/workspace'
      })
    ).resolves.toMatchObject({
      available: false,
      reason: 'engine-not-registered'
    })
  })

  it('hides availability when a supported engine is not authenticated', async () => {
    const adapter: AgentChatEngineAdapter = {
      ...createRecordingAdapter({}),
      probeCapabilities: vi.fn(() =>
        Promise.resolve({
          authenticated: false,
          diagnostic: {
            code: 'authentication-required' as const,
            message: 'authentication-required',
            recoverable: true
          },
          engineId: 'codex' as const,
          verdict: 'unsupported' as const
        })
      )
    }
    const runtime = createAgentChatRuntime({
      adapters: [adapter],
      fileStore: createTestFileStore(),
      now: () => '2026-05-12T00:00:00.000Z'
    })

    await expect(
      runtime.getAvailability({
        selectedEngineId: 'codex',
        workspaceRoot: '/workspace'
      })
    ).resolves.toMatchObject({
      available: false,
      diagnostic: {
        code: 'authentication-required'
      },
      reason: 'authentication-required'
    })
  })

  it('creates a draft session before native start', async () => {
    const runtime = createAgentChatRuntime({
      adapters: [createFakeAgentChatAdapter({ engineId: 'codex' })],
      fileStore: createTestFileStore(),
      now: () => '2026-05-12T00:00:00.000Z'
    })

    const session = await runtime.createDraftSession({
      engineId: 'codex',
      host: 'editor',
      sessionPurpose: 'document-chat',
      workspaceRoot: '/workspace'
    })

    expect(session.state).toBe('draft')
    expect(session.nativeSessionId).toBeUndefined()
  })

  it('writes attachments through the package runtime, not desktop code', async () => {
    const fileStore = createTestFileStore()
    const runtime = createAgentChatRuntime({
      adapters: [createFakeAgentChatAdapter({ engineId: 'codex' })],
      fileStore,
      now: () => '2026-05-12T00:00:00.000Z'
    })
    const session = await runtime.createDraftSession({
      engineId: 'codex',
      host: 'editor',
      sessionPurpose: 'document-chat',
      workspaceRoot: '/workspace'
    })

    const attachment = await runtime.saveAttachment({
      bytes: new Uint8Array([1, 2, 3]),
      fileName: 'paste.png',
      mimeType: 'image/png',
      sessionId: session.sessionId,
      workspaceRoot: '/workspace'
    })

    expect(attachment.safePath).toContain(
      `.mde/agent-chat/${session.sessionId}/attachments/paste.png`
    )
    expect(fileStore.writeFile).toHaveBeenCalled()
  })

  it('lists metadata-bound native sessions even when native cwd is unavailable', async () => {
    const adapter: AgentChatEngineAdapter = {
      ...createRecordingAdapter({}),
      listNativeSessions: vi.fn(() =>
        Promise.resolve([
          {
            nativeSessionId: 'thread-1',
            title: 'Bound native session'
          }
        ])
      )
    }
    const metadataStorage = createMemoryAgentChatMetadataStorage()
    await metadataStorage.bindNativeSession({
      nativeSessionId: 'thread-1',
      sessionId: 'mde-chat-bound',
      updatedAt: '2026-05-12T00:00:00.000Z',
      workspaceRoot: '/workspace'
    })
    const runtime = createAgentChatRuntime({
      adapters: [adapter],
      fileStore: createTestFileStore(),
      metadataStorage,
      now: () => '2026-05-12T00:00:00.000Z'
    })

    await expect(
      runtime.listSessions({
        selectedEngineId: 'codex',
        workspaceRoot: '/workspace'
      })
    ).resolves.toMatchObject([
      {
        nativeSessionId: 'thread-1',
        sessionId: 'mde-chat-bound',
        state: 'stopped'
      }
    ])
  })

  it('lists metadata-bound native sessions when native history listing fails', async () => {
    const adapter: AgentChatEngineAdapter = {
      ...createRecordingAdapter({}),
      listNativeSessions: vi.fn(() =>
        Promise.reject(new Error('native history unavailable'))
      )
    }
    const metadataStorage = createMemoryAgentChatMetadataStorage()
    await metadataStorage.bindNativeSession({
      nativeSessionId: 'thread-1',
      sessionId: 'mde-chat-bound',
      updatedAt: '2026-05-12T00:00:00.000Z',
      workspaceRoot: '/workspace'
    })
    const runtime = createAgentChatRuntime({
      adapters: [adapter],
      fileStore: createTestFileStore(),
      metadataStorage,
      now: () => '2026-05-12T00:00:00.000Z'
    })

    await expect(
      runtime.listSessions({
        selectedEngineId: 'codex',
        workspaceRoot: '/workspace'
      })
    ).resolves.toMatchObject([
      {
        nativeSessionId: 'thread-1',
        sessionId: 'mde-chat-bound',
        state: 'stopped'
      }
    ])
  })

  it('preserves native session titles when listing sessions', async () => {
    const adapter: AgentChatEngineAdapter = {
      ...createRecordingAdapter({}),
      listNativeSessions: vi.fn(() =>
        Promise.resolve([
          {
            cwd: '/workspace',
            nativeSessionId: 'thread-1',
            title: 'Summarize README'
          }
        ])
      )
    }
    const runtime = createAgentChatRuntime({
      adapters: [adapter],
      fileStore: createTestFileStore(),
      now: () => '2026-05-12T00:00:00.000Z'
    })

    await expect(
      runtime.listSessions({
        selectedEngineId: 'codex',
        workspaceRoot: '/workspace'
      })
    ).resolves.toMatchObject([
      {
        nativeSessionId: 'thread-1',
        sessionId: 'mde-native-thread-1',
        title: 'Summarize README'
      }
    ])
  })

  it('uses the first user message as the draft session title before native title is available', async () => {
    const adapter = createRecordingAdapter({
      sendEvents: [
        {
          nativeSessionId: 'thread-1',
          sessionId: 'mde-chat-1',
          type: 'session-started'
        }
      ]
    })
    const runtime = createAgentChatRuntime({
      adapters: [adapter],
      fileStore: createTestFileStore(),
      now: () => '2026-05-12T00:00:00.000Z'
    })
    const session = await runtime.createDraftSession({
      engineId: 'codex',
      host: 'editor',
      sessionPurpose: 'document-chat',
      workspaceRoot: '/workspace'
    })
    const events: AgentChatEvent[] = []
    runtime.subscribe(session.sessionId, (event) => {
      events.push(event)
    })

    await runtime.sendMessage({
      contextManifest: createContextManifest(),
      content: '  Summarize   README and propose next steps  ',
      sessionId: session.sessionId,
      workspaceRoot: '/workspace'
    })

    const titleEvent = events.find((event) => event.type === 'session-updated')

    expect(titleEvent?.type).toBe('session-updated')
    if (titleEvent?.type !== 'session-updated') {
      throw new Error('Expected a session-updated event')
    }
    expect(titleEvent.session).toMatchObject({
      sessionId: session.sessionId,
      title: 'Summarize README and propose next steps'
    })
    await expect(
      runtime.listSessions({
        selectedEngineId: 'codex',
        workspaceRoot: '/workspace'
      })
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: session.sessionId,
          title: 'Summarize README and propose next steps'
        })
      ])
    )
  })

  it('emits an empty changed-file summary to clear stale changed-file UI', async () => {
    const adapter = createRecordingAdapter({
      sendEvents: [
        {
          nativeSessionId: 'thread-1',
          sessionId: 'mde-chat-1',
          type: 'session-started'
        }
      ]
    })
    const snapshots: AgentChatWorkspaceFileSnapshot[][] = [
      [{ hash: '1', path: 'docs/example.md' }],
      [{ hash: '1', path: 'docs/example.md' }]
    ]
    const runtime = createAgentChatRuntime({
      adapters: [adapter],
      fileStore: createTestFileStore(),
      now: () => '2026-05-12T00:00:00.000Z',
      snapshotProvider: {
        captureSnapshot: vi.fn(() => Promise.resolve(snapshots.shift() ?? []))
      }
    })
    const session = await runtime.createDraftSession({
      engineId: 'codex',
      host: 'editor',
      sessionPurpose: 'document-chat',
      workspaceRoot: '/workspace'
    })
    const events: AgentChatEvent[] = []
    runtime.subscribe(session.sessionId, (event) => {
      if (event.type === 'changed-files-updated') {
        events.push(event)
      }
    })

    await runtime.sendMessage({
      contextManifest: createContextManifest(),
      content: 'No-op',
      sessionId: session.sessionId,
      workspaceRoot: '/workspace'
    })

    expect(events).toEqual([
      {
        sessionId: session.sessionId,
        summary: {
          available: true,
          files: []
        },
        type: 'changed-files-updated'
      }
    ])
  })

  it('emits unavailable changed-file summaries without a generic diagnostic event', async () => {
    const adapter = createRecordingAdapter({
      sendEvents: [
        {
          nativeSessionId: 'thread-1',
          sessionId: 'mde-chat-1',
          type: 'session-started'
        }
      ]
    })
    const runtime = createAgentChatRuntime({
      adapters: [adapter],
      fileStore: createTestFileStore(),
      now: () => '2026-05-12T00:00:00.000Z',
      snapshotProvider: {
        captureSnapshot: vi.fn(() => Promise.reject(new Error('git unavailable')))
      }
    })
    const session = await runtime.createDraftSession({
      engineId: 'codex',
      host: 'editor',
      sessionPurpose: 'document-chat',
      workspaceRoot: '/workspace'
    })
    const events: AgentChatEvent[] = []
    runtime.subscribe(session.sessionId, (event) => {
      events.push(event)
    })

    await runtime.sendMessage({
      contextManifest: createContextManifest(),
      content: 'No-op',
      sessionId: session.sessionId,
      workspaceRoot: '/workspace'
    })

    expect(events).toContainEqual({
      sessionId: session.sessionId,
      summary: {
        available: false,
        diagnostic: {
          code: 'changed-files-unavailable',
          details: 'git unavailable',
          message: 'changed-files-unavailable',
          recoverable: true
        },
        files: []
      },
      type: 'changed-files-updated'
    })
    expect(
      events.some(
        (event) =>
          event.type === 'diagnostic' &&
          event.diagnostic.code === 'changed-files-unavailable'
      )
    ).toBe(false)
  })

  it('marks the session failed when the engine send rejects', async () => {
    const adapter = createRecordingAdapter({
      sendRejects: new Error('native failure')
    })
    const runtime = createAgentChatRuntime({
      adapters: [adapter],
      fileStore: createTestFileStore(),
      now: () => '2026-05-12T00:00:00.000Z'
    })
    const session = await runtime.createDraftSession({
      engineId: 'codex',
      host: 'editor',
      sessionPurpose: 'document-chat',
      workspaceRoot: '/workspace'
    })
    const events: AgentChatEvent[] = []
    runtime.subscribe(session.sessionId, (event) => {
      if (event.type === 'session-failed') {
        events.push(event)
      }
    })

    await expect(
      runtime.sendMessage({
        contextManifest: createContextManifest(),
        content: 'Run',
        sessionId: session.sessionId,
        workspaceRoot: '/workspace'
      })
    ).rejects.toThrow('native failure')

    expect(events).toMatchObject([
      {
        diagnostic: {
          code: 'turn-failed'
        },
        session: {
          sessionId: session.sessionId,
          state: 'failed'
        },
        type: 'session-failed'
      }
    ])
  })
})
