import type * as Electron from 'electron'

import { AGENT_CHAT_CHANNELS } from '../main/ipc/channels'
import type {
  AgentChatApi,
  AgentChatAttachment,
  AgentChatAvailabilityResponse,
  AgentChatEvent,
  AgentChatSession
} from '../shared/agentChat'

type IpcRenderer = Pick<
  typeof Electron.ipcRenderer,
  'invoke' | 'on' | 'removeListener'
>

export const createAgentChatApi = (
  ipcRenderer: IpcRenderer
): AgentChatApi => ({
  createDraftSession: (request) =>
    ipcRenderer.invoke(
      AGENT_CHAT_CHANNELS.createDraftSession,
      request
    ) as Promise<AgentChatSession>,
  getAvailability: (request) =>
    ipcRenderer.invoke(
      AGENT_CHAT_CHANNELS.getAvailability,
      request
    ) as Promise<AgentChatAvailabilityResponse>,
  listSessions: (request) =>
    ipcRenderer.invoke(
      AGENT_CHAT_CHANNELS.listSessions,
      request
    ) as Promise<readonly AgentChatSession[]>,
  onEvent: (listener) => {
    const handler = (_event: unknown, payload: AgentChatEvent): void => {
      listener(payload)
    }
    ipcRenderer.on(AGENT_CHAT_CHANNELS.event, handler)
    return () => {
      ipcRenderer.removeListener(AGENT_CHAT_CHANNELS.event, handler)
    }
  },
  releaseWorkspaceSubscriptions: (request) =>
    ipcRenderer.invoke(
      AGENT_CHAT_CHANNELS.releaseWorkspaceSubscriptions,
      request
    ) as Promise<void>,
  resumeSession: (request) =>
    ipcRenderer.invoke(
      AGENT_CHAT_CHANNELS.resumeSession,
      request
    ) as Promise<AgentChatSession>,
  saveAttachment: (request) =>
    ipcRenderer.invoke(
      AGENT_CHAT_CHANNELS.saveAttachment,
      request
    ) as Promise<AgentChatAttachment>,
  sendMessage: (request) =>
    ipcRenderer.invoke(
      AGENT_CHAT_CHANNELS.sendMessage,
      request
    ) as Promise<void>,
  stopSession: (request) =>
    ipcRenderer.invoke(
      AGENT_CHAT_CHANNELS.stopSession,
      request
    ) as Promise<void>
})
