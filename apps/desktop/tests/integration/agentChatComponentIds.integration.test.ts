import { describe, expect, it } from 'vitest'

import {
  COMPONENT_IDS,
  COMPONENT_NAME_ID_MAP
} from '../../src/renderer/src/componentIds'

describe('Agent Chat component ids', () => {
  it('exposes concrete Agent Chat component ids for renderer and manual coverage', () => {
    expect(COMPONENT_IDS.agentChat.actionButton).toBe('agent-chat.action-button')
    expect(COMPONENT_IDS.agentChat.attachImageButton).toBe(
      'agent-chat.attach-image-button'
    )
    expect(COMPONENT_IDS.agentChat.attachmentRemoveButton).toBe(
      'agent-chat.attachment-remove-button'
    )
    expect(COMPONENT_IDS.agentChat.changedFileRow).toBe(
      'agent-chat.changed-file-row'
    )
    expect(COMPONENT_IDS.agentChat.changedFiles).toBe('agent-chat.changed-files')
    expect(COMPONENT_IDS.agentChat.closeButton).toBe('agent-chat.close-button')
    expect(COMPONENT_IDS.agentChat.composer).toBe('agent-chat.composer')
    expect(COMPONENT_IDS.agentChat.messageField).toBe(
      'agent-chat.message-field'
    )
    expect(COMPONENT_IDS.agentChat.messageBox).toBe('agent-chat.message-box')
    expect(COMPONENT_IDS.agentChat.messageItem).toBe('agent-chat.message-item')
    expect(COMPONENT_IDS.agentChat.panel).toBe('agent-chat.panel')
    expect(COMPONENT_IDS.agentChat.resizeHandle).toBe(
      'agent-chat.resize-handle'
    )
    expect(COMPONENT_IDS.agentChat.thinkingStatus).toBe(
      'agent-chat.thinking-status'
    )

    expect(COMPONENT_NAME_ID_MAP).toMatchObject({
      agentChatActionButton: {
        componentId: 'agent-chat.action-button',
        standardName: 'Agent Chat Action Button'
      },
      agentChatAttachImageButton: {
        componentId: 'agent-chat.attach-image-button',
        standardName: 'Agent Chat Attach Image Button'
      },
      agentChatCloseButton: {
        componentId: 'agent-chat.close-button',
        standardName: 'Agent Chat Close Button'
      },
      agentChatMessageBox: {
        componentId: 'agent-chat.message-box',
        standardName: 'Agent Chat Message Box'
      },
      agentChatPanel: {
        componentId: 'agent-chat.panel',
        standardName: 'Agent Chat Panel'
      },
      agentChatResizeHandle: {
        componentId: 'agent-chat.resize-handle',
        standardName: 'Agent Chat Resize Handle'
      },
      agentChatThinkingStatus: {
        componentId: 'agent-chat.thinking-status',
        standardName: 'Agent Chat Thinking Status'
      }
    })
  })
})
