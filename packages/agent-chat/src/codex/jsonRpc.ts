import type { AgentChatChildProcess } from '../host'
import type {
  CodexClientNotification,
  CodexClientRequest,
  CodexServerNotification
} from './protocolTypes'

type JsonObject = Record<string, unknown>
type NotificationListener = (notification: CodexServerNotification) => void

export interface JsonRpcProcessClient {
  readonly close: () => void
  readonly notify: (method: CodexClientNotification['method']) => void
  readonly request: <T>(
    method: CodexClientRequest['method'],
    params: CodexClientRequest['params']
  ) => Promise<T>
  readonly subscribeNotifications: (listener: NotificationListener) => () => void
}

export interface JsonRpcProcessClientOptions {
  readonly child: AgentChatChildProcess
  readonly idPrefix?: string
}

export const createJsonRpcProcessClient = (
  options: JsonRpcProcessClientOptions
): JsonRpcProcessClient => {
  const idPrefix = options.idPrefix ?? 'mde-codex'
  const pending = new Map<
    string,
    {
      readonly reject: (error: Error) => void
      readonly resolve: (value: unknown) => void
    }
  >()
  const notificationListeners = new Set<NotificationListener>()
  let counter = 0
  let reading = false

  const handleLine = (line: string): void => {
    const trimmed = line.trim()
    if (!trimmed) {
      return
    }

    const message = JSON.parse(trimmed) as JsonObject
    if (typeof message.id === 'string') {
      const deferred = pending.get(message.id)
      if (!deferred) {
        return
      }
      pending.delete(message.id)
      if (message.error && typeof message.error === 'object') {
        const error = message.error as { readonly message?: string }
        deferred.reject(new Error(error.message ?? 'Codex app-server request failed'))
        return
      }
      deferred.resolve(message.result)
      return
    }

    if (typeof message.method === 'string') {
      notificationListeners.forEach((listener) =>
        listener(message as unknown as CodexServerNotification)
      )
    }
  }

  const ensureReadLoop = (): void => {
    if (reading) {
      return
    }
    reading = true
    void (async () => {
      let buffer = ''
      for await (const chunk of options.child.stdout) {
        buffer += chunk
        let newlineIndex = buffer.indexOf('\n')
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex)
          buffer = buffer.slice(newlineIndex + 1)
          handleLine(line)
          newlineIndex = buffer.indexOf('\n')
        }
      }
      if (buffer.trim()) {
        handleLine(buffer)
      }
    })().catch((error: unknown) => {
      const normalizedError =
        error instanceof Error ? error : new Error('Codex app-server stream failed')
      pending.forEach((deferred) => deferred.reject(normalizedError))
      pending.clear()
    })
  }

  return {
    close: () => {
      options.child.stdin.end()
      options.child.kill()
    },
    notify: (method) => {
      options.child.stdin.write(`${JSON.stringify({ method })}\n`)
      ensureReadLoop()
    },
    request: async <T>(
      method: CodexClientRequest['method'],
      params: CodexClientRequest['params']
    ): Promise<T> => {
      counter += 1
      const id = `${idPrefix}-${counter}`
      const payload = { id, method, params }
      const response = new Promise((resolve, reject) => {
        pending.set(id, { reject, resolve })
      })
      options.child.stdin.write(`${JSON.stringify(payload)}\n`)
      ensureReadLoop()
      return response as Promise<T>
    },
    subscribeNotifications: (listener) => {
      notificationListeners.add(listener)
      ensureReadLoop()
      return () => {
        notificationListeners.delete(listener)
      }
    }
  }
}
