import { describe, expect, it } from 'vitest'

import { createAutomationNotificationService } from '../../src/main/services/automation/automationNotificationService'

describe('automationNotificationService', () => {
  it('creates decision-required notification payloads with Automation Center deep links', () => {
    const service = createAutomationNotificationService({
      now: () => '2026-05-10T08:00:00.000Z'
    })

    const notification = service.notifyDecisionRequired({
      runId: 'run-1',
      taskId: 'task-1',
      title: 'READY Ship task'
    })

    expect(notification).toMatchObject({
      bodyArgs: {
        taskTitle: 'READY Ship task'
      },
      bodyKey: 'automation.notifications.decisionRequired.body',
      deepLink: {
        route: 'automation-center',
        runId: 'run-1',
        selectedTaskId: 'task-1'
      },
      titleKey: 'automation.notifications.decisionRequired.title',
      type: 'run.decision_required'
    })
    expect(service.resolveDeepLink(notification?.deepLink)).toEqual({
      selectedTaskId: 'task-1',
      windowMode: 'automation-center'
    })
  })

  it('notifies terminal runs without raw logs or local paths', () => {
    const service = createAutomationNotificationService({
      now: () => '2026-05-10T08:00:00.000Z'
    })

    const notification = service.notifyTerminalRun({
      rawLog: 'password=secret-value',
      runId: 'run-1',
      status: 'failed',
      taskId: 'task-1',
      title: '/Users/trump.wang/private/task.md'
    })

    expect(notification).toMatchObject({
      bodyArgs: {
        outcome: 'failed',
        taskTitle: 'task.md'
      },
      bodyKey: 'automation.notifications.terminalRun.body',
      titleKey: 'automation.notifications.terminalRun.title',
      type: 'run.terminal'
    })
    expect(JSON.stringify(notification)).not.toContain('secret-value')
    expect(JSON.stringify(notification)).not.toContain('/Users/trump.wang/private')
  })

  it('is a no-op when notifications are unsupported', () => {
    const service = createAutomationNotificationService({ supported: false })

    expect(
      service.notifyDecisionRequired({
        runId: 'run-1',
        taskId: 'task-1',
        title: 'READY Ship task'
      })
    ).toBeUndefined()
    expect(service.listNotifications()).toEqual([])
  })
})
