import { describe, expect, it } from 'vitest'

import {
  createAutomationTaskId,
  createUserPromptSourceItemId,
  createWorkspaceMarkdownSourceItemId
} from './taskIdentity'

describe('automation task identity', () => {
  it('creates owner-scoped task ids for the same discovered source', () => {
    const sourceItemId = 'workspace:/repo:.mde/docs/tasks/ready.md'

    expect(
      createAutomationTaskId({
        automationFlowId: 'flow-a',
        sourceItemId
      })
    ).not.toBe(
      createAutomationTaskId({
        automationFlowId: 'flow-b',
        sourceItemId
      })
    )
  })

  it('normalizes workspace markdown source identity paths', () => {
    expect(
      createWorkspaceMarkdownSourceItemId({
        relativePath: '.mde/docs/tasks/../tasks/ready.md',
        workspaceId: '/workspace'
      })
    ).toBe(
      createWorkspaceMarkdownSourceItemId({
        relativePath: '.mde/docs/tasks/ready.md',
        workspaceId: '/workspace'
      })
    )
  })

  it('normalizes semantic user prompt source identity paths', () => {
    expect(
      createUserPromptSourceItemId({
        relativePath: './weekly/../daily/ready.md'
      })
    ).toBe(
      createUserPromptSourceItemId({
        relativePath: 'daily/ready.md'
      })
    )
  })

  it('can scope user prompt source identity to its root owner', () => {
    const relativePath = 'daily/ready.md'

    expect(
      createUserPromptSourceItemId({
        relativePath,
        userPromptRoot: '/prompt/root-a'
      })
    ).not.toBe(
      createUserPromptSourceItemId({
        relativePath,
        userPromptRoot: '/prompt/root-b'
      })
    )
  })
})
