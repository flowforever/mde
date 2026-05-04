import type { EditorHostError } from './types'

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
