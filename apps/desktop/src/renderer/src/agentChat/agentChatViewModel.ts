import type { AgentChatAvailabilityResponse } from '../../../shared/agentChat';

export const EDITOR_AGENT_CHAT_ENGINE_ID = 'codex' as const;

export const shouldShowAgentChatEntry = (
  availability: AgentChatAvailabilityResponse | null | undefined,
): boolean =>
  availability?.available === true &&
  availability.engineId === EDITOR_AGENT_CHAT_ENGINE_ID;
