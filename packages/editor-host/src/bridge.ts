import type { EditorHostError, EditorHostResult } from './types'

export interface EditorHostBridgeMessage<TPayload = unknown> {
  readonly id: string
  readonly payload: TPayload
  readonly type: string
  readonly version: 1
}

export interface EditorHostBridgeResponse<TPayload = unknown> {
  readonly error?: EditorHostError
  readonly id: string
  readonly payload?: TPayload
  readonly version: 1
}

export type EditorHostBridgePayloadValidator<TPayload> = (
  payload: unknown
) => payload is TPayload

export interface EditorHostBridgeMessageValidationOptions<TPayload> {
  readonly type?: string
  readonly validatePayload?: EditorHostBridgePayloadValidator<TPayload>
}

export interface EditorHostBridgeResponseValidationOptions<TPayload> {
  readonly validatePayload?: EditorHostBridgePayloadValidator<TPayload>
}

const editorHostErrorCodes = new Set([
  'cancelled',
  'conflict',
  'not-found',
  'outside-workspace',
  'permission-denied',
  'read-only',
  'unknown',
  'unsupported',
  'validation'
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const validationError = (message: string): EditorHostResult<never> =>
  Object.freeze({
    error: Object.freeze({
      code: 'validation',
      message
    }),
    ok: false as const
  })

const isEditorHostError = (value: unknown): value is EditorHostError =>
  isRecord(value) &&
  typeof value.code === 'string' &&
  editorHostErrorCodes.has(value.code) &&
  (value.message === undefined || typeof value.message === 'string') &&
  (value.retryable === undefined || typeof value.retryable === 'boolean')

export const createEditorHostBridgeMessage = <TPayload>(input: {
  readonly id: string
  readonly payload: TPayload
  readonly type: string
}): EditorHostBridgeMessage<TPayload> =>
  Object.freeze({
    ...input,
    version: 1 as const
  })

export const createEditorHostBridgeResponse = <TPayload>(input: {
  readonly error?: EditorHostError
  readonly id: string
  readonly payload?: TPayload
}): EditorHostBridgeResponse<TPayload> =>
  Object.freeze({
    ...input,
    version: 1 as const
  })

export const parseEditorHostBridgeMessage = <TPayload = unknown>(
  value: unknown,
  options: EditorHostBridgeMessageValidationOptions<TPayload> = {}
): EditorHostResult<EditorHostBridgeMessage<TPayload>> => {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof value.type !== 'string' ||
    value.type.length === 0 ||
    !('payload' in value) ||
    (options.type !== undefined && value.type !== options.type)
  ) {
    return validationError('Invalid editor host bridge message')
  }

  if (
    options.validatePayload !== undefined &&
    !options.validatePayload(value.payload)
  ) {
    return validationError('Invalid editor host bridge message payload')
  }

  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      id: value.id,
      payload: value.payload as TPayload,
      type: value.type,
      version: 1 as const
    })
  })
}

export const parseEditorHostBridgeResponse = <TPayload = unknown>(
  value: unknown,
  options: EditorHostBridgeResponseValidationOptions<TPayload> = {}
): EditorHostResult<EditorHostBridgeResponse<TPayload>> => {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.id !== 'string' ||
    value.id.length === 0
  ) {
    return validationError('Invalid editor host bridge response')
  }

  if ('error' in value) {
    const responseError = value.error

    if (!isEditorHostError(responseError) || 'payload' in value) {
      return validationError('Invalid editor host bridge response')
    }

    return Object.freeze({
      ok: true as const,
      value: Object.freeze({
        error: responseError,
        id: value.id,
        version: 1 as const
      })
    })
  }

  if (
    options.validatePayload !== undefined &&
    !options.validatePayload(value.payload)
  ) {
    return validationError('Invalid editor host bridge response payload')
  }

  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      id: value.id,
      ...('payload' in value ? { payload: value.payload as TPayload } : {}),
      version: 1 as const
    })
  })
}
