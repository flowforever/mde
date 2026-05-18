import { describe, expect, it } from 'vitest'

import {
  resolveAutomationFlowExecutors,
  selectAutomationFlowExecutor
} from './executors'

describe('automation flow executor resolution', () => {
  it('merges explicit ids with auto-discovered Markdown executors', () => {
    const result = resolveAutomationFlowExecutors({
      autoDiscoveredMarkdownExecutors: [
        { path: '/repo/.mde/automation-flows/flow-a/implementation.md' }
      ],
      declarations: [{ enabled: false, id: 'implementation', type: 'markdown' }],
      flowId: 'flow-a'
    })

    expect(result.diagnostics).toEqual([])
    expect(result.executors[0]).toMatchObject({
      autoDiscovered: false,
      enabled: false,
      executorId: 'implementation',
      sourcePath: '/repo/.mde/automation-flows/flow-a/implementation.md',
      type: 'markdown'
    })
  })

  it('reports duplicate explicit ids as blocking diagnostics', () => {
    const result = resolveAutomationFlowExecutors({
      autoDiscoveredMarkdownExecutors: [],
      declarations: [
        { id: 'Implementation', type: 'markdown' },
        { id: 'implementation', type: 'skill', ref: 'skill:implementation' }
      ],
      flowId: 'flow-a'
    })

    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'automationFlow.duplicateExecutorId',
        severity: 'error'
      })
    ])
  })

  it('reports duplicate Markdown paths under different ids', () => {
    const result = resolveAutomationFlowExecutors({
      autoDiscoveredMarkdownExecutors: [],
      declarations: [
        { id: 'implementation', path: './flow-a/run.md', type: 'markdown' },
        { id: 'verification', path: './flow-a/run.md', type: 'markdown' }
      ],
      flowId: 'flow-a'
    })

    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'automationFlow.duplicateExecutorPath',
        severity: 'error'
      })
    ])
  })

  it('appends auto-discovered executors after explicit declarations', () => {
    const result = resolveAutomationFlowExecutors({
      autoDiscoveredMarkdownExecutors: [
        { path: '/repo/.mde/automation-flows/flow-a/verify.md' }
      ],
      declarations: [{ id: 'implementation', type: 'markdown' }],
      flowId: 'flow-a'
    })

    expect(result.executors.map((executor) => executor.executorId)).toEqual([
      'implementation',
      'verify'
    ])
  })

  it('uses flow order then normalized executor id for equal handle matches', () => {
    const { executors } = resolveAutomationFlowExecutors({
      autoDiscoveredMarkdownExecutors: [],
      declarations: [
        {
          handles: { sourceTypes: ['workspace-markdown'] },
          id: 'beta',
          type: 'markdown'
        },
        {
          handles: { sourceTypes: ['workspace-markdown'] },
          id: 'alpha',
          type: 'markdown'
        }
      ],
      flowId: 'flow-a'
    })

    expect(
      selectAutomationFlowExecutor({
        executors,
        sourceType: 'workspace-markdown'
      }).executor?.executorId
    ).toBe('beta')
  })

  it('returns a missing-executor diagnostic when no enabled executor exists', () => {
    const { executors } = resolveAutomationFlowExecutors({
      autoDiscoveredMarkdownExecutors: [],
      declarations: [{ enabled: false, id: 'implementation', type: 'markdown' }],
      flowId: 'flow-a'
    })

    const selection = selectAutomationFlowExecutor({ executors })

    expect(selection).toMatchObject({
      diagnostics: [
        {
          code: 'automationFlow.missingExecutor',
          severity: 'error'
        }
      ]
    })
    expect(selection.executor).toBeUndefined()
  })

  it('lets requiredExecutorId override handle matching and flow order', () => {
    const { executors } = resolveAutomationFlowExecutors({
      autoDiscoveredMarkdownExecutors: [],
      declarations: [
        {
          handles: { sourceTypes: ['workspace-markdown'] },
          id: 'implementation',
          type: 'markdown'
        },
        { id: 'verification', type: 'markdown' }
      ],
      flowId: 'flow-a'
    })

    expect(
      selectAutomationFlowExecutor({
        executors,
        requiredExecutorId: 'verification',
        sourceType: 'workspace-markdown'
      }).executor?.executorId
    ).toBe('verification')
  })

  it('lets requiredExecutorRef resolve skill executors before handle matching', () => {
    const { executors } = resolveAutomationFlowExecutors({
      autoDiscoveredMarkdownExecutors: [],
      declarations: [
        {
          handles: { sourceTypes: ['workspace-markdown'] },
          id: 'implementation',
          type: 'markdown'
        },
        {
          id: 'execute-picked-task',
          ref: 'skill:execute-picked-task',
          type: 'skill'
        }
      ],
      flowId: 'flow-a'
    })

    expect(
      selectAutomationFlowExecutor({
        executors,
        requiredExecutorRef: 'skill:execute-picked-task',
        sourceType: 'workspace-markdown'
      }).executor?.executorId
    ).toBe('execute-picked-task')
  })

  it('blocks disabled or unresolved required executors', () => {
    const { executors } = resolveAutomationFlowExecutors({
      autoDiscoveredMarkdownExecutors: [],
      declarations: [
        { enabled: false, id: 'implementation', type: 'markdown' },
        {
          id: 'execute-picked-task',
          ref: 'skill:execute-picked-task',
          type: 'skill'
        }
      ],
      flowId: 'flow-a'
    })

    expect(
      selectAutomationFlowExecutor({
        executors,
        requiredExecutorId: 'implementation'
      }).diagnostics[0]
    ).toMatchObject({ code: 'automationFlow.requiredExecutorDisabled' })
    expect(
      selectAutomationFlowExecutor({
        executors,
        requiredExecutorRef: 'skill:missing'
      }).diagnostics[0]
    ).toMatchObject({ code: 'automationFlow.requiredExecutorMissing' })
  })
})
