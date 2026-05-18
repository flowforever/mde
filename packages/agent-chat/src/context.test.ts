import { describe, expect, it } from 'vitest'

import { buildCodexUserInputItems, validateAgentChatContextManifest } from './context'

describe('validateAgentChatContextManifest', () => {
  it('keeps V1 context to workspace, document, selection, blocks, and permission mode', () => {
    const manifest = validateAgentChatContextManifest({
      currentDocumentPath: '/workspace/doc.md',
      currentDocumentSnapshot: '# Title',
      modelName: 'gpt-5.4',
      permissionMode: 'max-permission',
      selectedBlockIds: ['block-1'],
      selectedText: 'Title',
      sessionPurpose: 'document-chat',
      workspaceRoot: '/workspace'
    })

    expect(manifest.selectedBlockIds).toEqual(['block-1'])
    expect(manifest.modelName).toBe('gpt-5.4')
    expect(manifest).not.toHaveProperty('lineRange')
  })

  it('keeps automation authoring context immutable and concise', () => {
    const manifest = validateAgentChatContextManifest({
      automationAuthoringContext: {
        diagnostics: ['Missing executor'],
        executorRefs: ['skill · code-review · repo-local · /repo/.codex/skills/code-review/SKILL.md'],
        flowPath: ' .mde/automation-flows/review.md ',
        runtimeConstraints: ['Task execution stays user-initiated']
      },
      currentDocumentPath: '/workspace/.mde/automation-flows/review.md',
      currentDocumentSnapshot: '# Review flow',
      permissionMode: 'max-permission',
      selectedBlockIds: [],
      selectedText: '',
      sessionPurpose: 'document-chat',
      workspaceRoot: '/workspace'
    })

    expect(manifest.automationAuthoringContext).toEqual({
      diagnostics: ['Missing executor'],
      executorRefs: ['skill · code-review · repo-local · /repo/.codex/skills/code-review/SKILL.md'],
      flowPath: '.mde/automation-flows/review.md',
      runtimeConstraints: ['Task execution stays user-initiated']
    })
    expect(Object.isFrozen(manifest.automationAuthoringContext?.diagnostics)).toBe(true)
  })
})

describe('buildCodexUserInputItems', () => {
  it('includes the current document snapshot and selection context in Codex text input', () => {
    const items = buildCodexUserInputItems({
      attachments: [],
      content: 'Explain the edit',
      contextManifest: {
        currentDocumentPath: 'docs/example.md',
        currentDocumentSnapshot: '# Example\n\nSelected body',
        permissionMode: 'max-permission',
        selectedBlockIds: ['block-1'],
        selectedText: 'Selected body',
        sessionPurpose: 'document-chat',
        workspaceRoot: '/workspace'
      },
      sessionId: 'mde-chat-1',
      workspaceRoot: '/workspace'
    })

    expect(items).toEqual([
      {
        text: [
          'Current document path:\ndocs/example.md',
          'Selected block ids:\nblock-1',
          'Selected text:\nSelected body',
          'Current Markdown snapshot:\n# Example\n\nSelected body',
          'User message:\nExplain the edit'
        ].join('\n\n'),
        text_elements: [],
        type: 'text'
      }
    ])
  })

  it('includes automation flow authoring context in Codex text input', () => {
    const items = buildCodexUserInputItems({
      attachments: [],
      content: 'Help finish this flow',
      contextManifest: {
        automationAuthoringContext: {
          diagnostics: ['missing executor binding'],
          executorRefs: [
            'markdown · implementation · .mde/automation-flows/review/implementation.md',
            'skill · code-review · repo-local · /repo/.codex/skills/code-review/SKILL.md'
          ],
          flowPath: '.mde/automation-flows/review.md',
          runtimeConstraints: [
            'No enabled executor is currently resolved for this flow.',
            'sourceClass: repo-local'
          ]
        },
        currentDocumentPath: '.mde/automation-flows/review.md',
        currentDocumentSnapshot: '# Review flow',
        permissionMode: 'max-permission',
        selectedBlockIds: [],
        selectedText: '',
        sessionPurpose: 'document-chat',
        workspaceRoot: '/workspace'
      },
      sessionId: 'mde-chat-1',
      workspaceRoot: '/workspace'
    })

    const textItem = items[0]

    expect(textItem).toMatchObject({
      type: 'text'
    })
    expect(textItem?.type === 'text' ? textItem.text : '').toContain(
      'Automation flow authoring context:'
    )
    expect(textItem?.type === 'text' ? textItem.text : '').toContain(
      'Flow path: .mde/automation-flows/review.md'
    )
    expect(textItem?.type === 'text' ? textItem.text : '').toContain(
      '- markdown · implementation'
    )
    expect(textItem?.type === 'text' ? textItem.text : '').toContain(
      'Diagnostics:\n- missing executor binding'
    )
    expect(textItem?.type === 'text' ? textItem.text : '').toContain(
      'Runtime constraints:\n- No enabled executor'
    )
    expect(textItem?.type === 'text' ? textItem.text : '').toContain(
      'User message:\nHelp finish this flow'
    )
  })
})
