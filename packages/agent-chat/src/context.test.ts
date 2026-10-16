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
})


it('treats a legacy flow as ordinary document content without executor instructions', () => {
  const legacyManifest = {
    automationAuthoringContext: {
      diagnostics: ['LEGACY-DIAGNOSTIC'], executorRefs: ['LEGACY-EXECUTOR'],
      flowPath: '.mde/automation-flows/review.md',
    },
    currentDocumentPath: '/workspace/.mde/automation-flows/review.md',
    currentDocumentSnapshot: '# Automation flow authoring context: user-owned text',
    permissionMode: 'max-permission' as const, selectedBlockIds: ['block-1'],
    selectedText: 'user-owned text', sessionPurpose: 'document-chat' as const,
    workspaceRoot: '/workspace',
  };
  expect(validateAgentChatContextManifest(legacyManifest)).not.toHaveProperty('automationAuthoringContext');
  const items = buildCodexUserInputItems({
    attachments: [], content: 'Explain this document', contextManifest: legacyManifest,
    sessionId: 'chat-legacy', workspaceRoot: '/workspace',
  });
  const item = items.find((entry) => entry.type === 'text');
  const prompt = item?.type === 'text' ? item.text : '';
  expect(prompt).toContain(legacyManifest.currentDocumentSnapshot);
  expect(prompt).toContain('Selected text:\nuser-owned text');
  expect(prompt).not.toContain('LEGACY-EXECUTOR');
  expect(prompt).not.toContain('LEGACY-DIAGNOSTIC');
});
