export type AutomationRuntimeState = 'active' | 'recovering' | 'stopping'

export type AutomationRunLifecycleState =
  | 'abandoned'
  | 'failed'
  | 'interrupted'
  | 'needs-me'
  | 'recoverable'
  | 'running'
  | 'starting'
  | 'succeeded'

export interface AutomationRunLockIdentity {
  readonly automationFlowId: string
  readonly automationFlowOwnerKey?: string
  readonly executorSnapshotId?: string
  readonly profileId: string
  readonly sourceItemId: string
  readonly taskDataSnapshotId?: string
  readonly taskId: string
  readonly workspaceScope: string
}

export interface AutomationRuntimeOwnerLease {
  readonly appDataPath: string
  readonly heartbeatAt: string
  readonly ownerId: string
  readonly processId: number
  readonly schemaVersion: 1
  readonly startedAt: string
}
