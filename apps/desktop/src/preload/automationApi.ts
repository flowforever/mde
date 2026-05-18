import type * as Electron from 'electron'

import { AUTOMATION_CHANNELS } from '../main/ipc/channels'
import type { AutomationApi } from '../shared/automation'

type IpcRenderer = Pick<typeof Electron.ipcRenderer, 'invoke'>

export const createAutomationApi = (
  ipcRenderer: IpcRenderer
): AutomationApi => ({
  archiveFlow: (command) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.archiveFlow,
      command
    ) as ReturnType<AutomationApi['archiveFlow']>,
  applyGlobalFlowToWorkspace: (request) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.applyGlobalFlowToWorkspace,
      request
    ) as ReturnType<AutomationApi['applyGlobalFlowToWorkspace']>,
  cancelRun: (command) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.cancelRun,
      command
    ) as ReturnType<AutomationApi['cancelRun']>,
  createExecutorDraft: (request) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.createExecutorDraft,
      request
    ) as ReturnType<AutomationApi['createExecutorDraft']>,
  createFlowDraft: (request) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.createFlowDraft,
      request
    ) as ReturnType<AutomationApi['createFlowDraft']>,
  createFlowFromTemplate: (request) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.createFlowFromTemplate,
      request
    ) as ReturnType<AutomationApi['createFlowFromTemplate']>,
  deleteFlow: (command) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.deleteFlow,
      command
    ) as ReturnType<AutomationApi['deleteFlow']>,
  getExplorerAutomationProjection: (request) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.getExplorerAutomationProjection,
      request
    ) as ReturnType<AutomationApi['getExplorerAutomationProjection']>,
  getProjection: (request) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.getProjection,
      request
    ) as ReturnType<AutomationApi['getProjection']>,
  listCapabilityReports: (request) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.listCapabilityReports,
      request
    ) as ReturnType<AutomationApi['listCapabilityReports']>,
  listReports: () =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.listReports
    ) as ReturnType<AutomationApi['listReports']>,
  listTemplates: () =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.listTemplates
    ) as ReturnType<AutomationApi['listTemplates']>,
  loadFlowDefinition: (command) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.loadFlowDefinition,
      command
    ) as ReturnType<AutomationApi['loadFlowDefinition']>,
  openNativeSession: (command) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.openNativeSession,
      command
    ) as ReturnType<AutomationApi['openNativeSession']>,
  openAutomationManagementTarget: (request) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.openAutomationManagementTarget,
      request
    ) as ReturnType<AutomationApi['openAutomationManagementTarget']>,
  refreshSkillCatalog: () =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.refreshSkillCatalog
    ) as ReturnType<AutomationApi['refreshSkillCatalog']>,
  removeAppliedGlobalFlowFromWorkspace: (request) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.removeAppliedGlobalFlowFromWorkspace,
      request
    ) as ReturnType<AutomationApi['removeAppliedGlobalFlowFromWorkspace']>,
  renameFlow: (command) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.renameFlow,
      command
    ) as ReturnType<AutomationApi['renameFlow']>,
  restoreFlow: (command) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.restoreFlow,
      command
    ) as ReturnType<AutomationApi['restoreFlow']>,
  resumeRun: (command) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.resumeRun,
      command
    ) as ReturnType<AutomationApi['resumeRun']>,
  saveFlowDefinition: (command) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.saveFlowDefinition,
      command
    ) as ReturnType<AutomationApi['saveFlowDefinition']>,
  setFlowLifecycle: (command) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.setFlowLifecycle,
      command
    ) as ReturnType<AutomationApi['setFlowLifecycle']>,
  startRun: (command) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.startRun,
      command
    ) as ReturnType<AutomationApi['startRun']>,
  submitDecision: (command) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.submitDecision,
      command
    ) as ReturnType<AutomationApi['submitDecision']>,
  updateFilters: (command) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.updateFilters,
      command
    ) as ReturnType<AutomationApi['updateFilters']>,
  validateTemplateInput: (request) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.validateTemplateInput,
      request
    ) as ReturnType<AutomationApi['validateTemplateInput']>
})
