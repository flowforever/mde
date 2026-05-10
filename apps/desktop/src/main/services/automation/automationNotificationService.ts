import { basename } from 'node:path'

import type { MdeWindowMode } from '../../../shared/windowMode'

type AutomationNotificationType = 'run.decision_required' | 'run.terminal'

export interface AutomationNotificationDeepLink {
  readonly route: 'automation-center'
  readonly runId: string
  readonly selectedTaskId: string
}

export interface AutomationNotificationPayload {
  readonly bodyArgs: Record<string, string>
  readonly bodyKey: string
  readonly createdAt: string
  readonly deepLink?: AutomationNotificationDeepLink
  readonly notificationId: string
  readonly titleKey: string
  readonly type: AutomationNotificationType
}

interface CreateAutomationNotificationServiceOptions {
  readonly now?: () => string
  readonly supported?: boolean
}

interface NotifyDecisionRequiredInput {
  readonly runId: string
  readonly taskId: string
  readonly title: string
}

interface NotifyTerminalRunInput {
  readonly rawLog?: string
  readonly runId: string
  readonly status: 'cancelled' | 'failed' | 'succeeded'
  readonly taskId: string
  readonly title: string
}

interface ResolvedAutomationDeepLink {
  readonly selectedTaskId: string
  readonly windowMode: MdeWindowMode
}

export interface AutomationNotificationService {
  readonly listNotifications: () => readonly AutomationNotificationPayload[]
  readonly notifyDecisionRequired: (
    input: NotifyDecisionRequiredInput
  ) => AutomationNotificationPayload | undefined
  readonly notifyTerminalRun: (
    input: NotifyTerminalRunInput
  ) => AutomationNotificationPayload | undefined
  readonly resolveDeepLink: (
    deepLink: AutomationNotificationDeepLink | undefined
  ) => ResolvedAutomationDeepLink | undefined
}

const redactSensitiveText = (text: string): string =>
  text
    .replace(
      /\b(?:authorization:\s*bearer|api[_-]?key|password|token)\s*[:=]\s*[^\s,;]+/giu,
      (match) => `${match.split(/[:=]/u)[0]}=[redacted]`
    )
    .replace(/\bBearer\s+[^\s,;]+/giu, 'Bearer [redacted]')

const sanitizeTaskTitle = (title: string): string => {
  const trimmedTitle = title.trim()
  const pathSafeTitle = /[/\\]/u.test(trimmedTitle)
    ? basename(trimmedTitle)
    : trimmedTitle

  return redactSensitiveText(pathSafeTitle)
}

export const createAutomationNotificationService = ({
  now = () => new Date().toISOString(),
  supported = true
}: CreateAutomationNotificationServiceOptions = {}): AutomationNotificationService => {
  const notifications: AutomationNotificationPayload[] = []
  const pushNotification = (
    payload: Omit<AutomationNotificationPayload, 'createdAt' | 'notificationId'>
  ): AutomationNotificationPayload | undefined => {
    if (!supported) {
      return undefined
    }

    const notification = Object.freeze({
      ...payload,
      createdAt: now(),
      notificationId: `automation-notification-${notifications.length + 1}`
    }) satisfies AutomationNotificationPayload

    notifications.push(notification)

    return notification
  }

  const service: AutomationNotificationService = {
    listNotifications() {
      return Object.freeze([...notifications])
    },
    notifyDecisionRequired({ runId, taskId, title }) {
      return pushNotification({
        bodyArgs: Object.freeze({
          taskTitle: sanitizeTaskTitle(title)
        }),
        bodyKey: 'automation.notifications.decisionRequired.body',
        deepLink: Object.freeze({
          route: 'automation-center',
          runId,
          selectedTaskId: taskId
        }),
        titleKey: 'automation.notifications.decisionRequired.title',
        type: 'run.decision_required'
      })
    },
    notifyTerminalRun({ runId, status, taskId, title }) {
      return pushNotification({
        bodyArgs: Object.freeze({
          outcome: status,
          taskTitle: sanitizeTaskTitle(title)
        }),
        bodyKey: 'automation.notifications.terminalRun.body',
        deepLink: Object.freeze({
          route: 'automation-center',
          runId,
          selectedTaskId: taskId
        }),
        titleKey: 'automation.notifications.terminalRun.title',
        type: 'run.terminal'
      })
    },
    resolveDeepLink(deepLink) {
      if (deepLink?.route !== 'automation-center') {
        return undefined
      }

      return Object.freeze({
        selectedTaskId: deepLink.selectedTaskId,
        windowMode: 'automation-center'
      })
    }
  }

  return Object.freeze(service)
}
