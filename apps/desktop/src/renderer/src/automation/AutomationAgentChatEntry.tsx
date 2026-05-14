import { MessageSquare, X } from 'lucide-react'
import { useEffect, useMemo, useState, type JSX } from 'react'

import { AgentChatPanel } from '../agentChat/AgentChatPanel'
import { COMPONENT_IDS } from '../componentIds'
import type { AppText } from '../i18n/appLanguage'
import type { AgentChatApi, AgentChatContextManifest } from '../../../shared/agentChat'

interface AutomationAgentChatEntryProps {
  readonly agentChatApi?: AgentChatApi
  readonly text: AppText
  readonly workspaceRoot?: string
}

interface AgentChatAvailabilityState {
  readonly available: boolean
  readonly workspaceRoot: string
}

export const AutomationAgentChatEntry = ({
  agentChatApi,
  text,
  workspaceRoot
}: AutomationAgentChatEntryProps): JSX.Element | null => {
  const [availability, setAvailability] =
    useState<AgentChatAvailabilityState | null>(null)
  const [open, setOpen] = useState(false)
  const contextManifest = useMemo<AgentChatContextManifest | null>(
    () =>
      workspaceRoot === undefined
        ? null
        : {
            currentDocumentSnapshot: '',
            permissionMode: 'max-permission',
            selectedBlockIds: [],
            selectedText: '',
            sessionPurpose: 'automation-task',
            workspaceRoot
          },
    [workspaceRoot]
  )

  useEffect(() => {
    let cancelled = false

    if (agentChatApi === undefined || workspaceRoot === undefined) {
      return () => {
        cancelled = true
      }
    }

    void agentChatApi
      .getAvailability({
        selectedEngineId: 'codex',
        workspaceRoot
      })
      .then((result) => {
        if (!cancelled) {
          setAvailability({
            available: result.available,
            workspaceRoot
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailability({
            available: false,
            workspaceRoot
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [agentChatApi, workspaceRoot])

  const available =
    availability !== null &&
    availability.workspaceRoot === workspaceRoot &&
    availability.available

  if (
    !available ||
    agentChatApi === undefined ||
    contextManifest === null ||
    workspaceRoot === undefined
  ) {
    return null
  }

  return (
    <section
      aria-label={text('automation.agentChat')}
      className={`automation-agent-chat-entry${
        open ? ' automation-agent-chat-entry--open' : ''
      }`}
      data-component-id={COMPONENT_IDS.automation.agentChatEntry}
    >
      {open ? (
        <AgentChatPanel
          api={agentChatApi}
          contextManifest={contextManifest}
          host="automation-center"
          onClose={() => {
            setOpen(false)
          }}
          text={text}
          workspaceRoot={workspaceRoot}
        />
      ) : (
        <button
          aria-label={text('automation.openAgentChat')}
          className="automation-agent-chat-button"
          data-component-id={COMPONENT_IDS.automation.agentChatButton}
          onClick={() => {
            setOpen(true)
          }}
          title={text('automation.openAgentChat')}
          type="button"
        >
          <MessageSquare aria-hidden="true" size={16} />
          <span>{text('automation.agentChat')}</span>
        </button>
      )}
      {open ? (
        <button
          aria-label={text('automation.closeAgentChat')}
          className="automation-agent-chat-collapse"
          data-component-id={COMPONENT_IDS.automation.agentChatCloseButton}
          onClick={() => {
            setOpen(false)
          }}
          title={text('automation.closeAgentChat')}
          type="button"
        >
          <X aria-hidden="true" size={14} />
        </button>
      ) : null}
    </section>
  )
}
