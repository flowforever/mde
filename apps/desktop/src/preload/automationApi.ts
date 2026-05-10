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
  cancelRun: (command) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.cancelRun,
      command
    ) as ReturnType<AutomationApi['cancelRun']>,
  createFlowFromTemplate: (request) =>
    ipcRenderer.invoke(
      AUTOMATION_CHANNELS.createFlowFromTemplate,
      request
    ) as ReturnType<AutomationApi['createFlowFromTemplate']>,
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
