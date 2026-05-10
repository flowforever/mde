# Agent CLI Adapter Integration

## Purpose

MDE Automation Center should be able to add future Agent CLIs without redesigning task discovery, Flowline, phase progress, evidence, or human-decision handling.

This document defines the adapter interface and the capability checklist used to decide whether an Agent CLI can support the full MDE automation feature set.

## Adapter Boundary

MDE owns:

* automation-flow parsing and validation

* task discovery and ownership

* run identity and run history

* phase plans, decisions, evidence, reports, and Flowline projections

* user confirmations and notification routing

* workspace-local and user-global storage

The Agent CLI owns:

* native model session execution

* its own session history

* tool execution inside its native runtime

* native permission prompts or sandbox policy

* adapter-specific logs

MDE must not mutate the Agent CLI's native session store. The adapter may store references to native sessions and expose "open session" actions.

## 2026-05-10 Correction: Required Runtime Semantics

The adapter contract is execution-critical, not a cosmetic capability probe. An
adapter that cannot start a real session must not emit READY task runs as if it
can.

Required semantics:

* `probeCapabilities()` verifies that the executable can create a session, set
  the workspace cwd, expose or capture a native session id, emit structured
  events or JSONL, provide a final report, and support resume or explicit
  continuation.

* `startRun()` starts a discovery or task session and yields normalized events.
  The first accepted run event must bind the MDE `runId` to one primary native
  adapter session id.

* `resumeRun()` resumes the same native session when possible. If the adapter
  cannot resume it, the adapter may create a continuation session under the
  same MDE `runId` and must return updated session lineage.

* `cancelRun()` cancels an active adapter process or returns a clear diagnostic
  if cancellation is unavailable.

* `openNativeSession()` opens the native Codex or Claude Code session identified
  by `adapterSessionId`, or returns a clear unavailable diagnostic.

* Discovery runs return normalized task sources. Task runs receive the selected
  discovered source snapshot and source content in the prompt bundle.

* Every task run is a full native Codex or Claude Code session. One MDE
  `runId` binds to one primary `adapterSessionId`; multiple task runs must not
  share the same native session. Resume continues that session when possible,
  or creates an explicit continuation session under the same MDE `runId`.

* Running, Needs me, Done, and Failed are projected from normalized structured
  events and final reports, not guessed from free-form final text.

## Required Adapter Interfaces

```typescript
type AgentCliId = "codex" | "claude-code" | string;

type AgentCliAdapter = {
  id: AgentCliId;
  displayName: string;

  detect(): Promise<AgentCliDetection>;
  probeCapabilities(): Promise<AgentCliCapabilityReport>;

  authoring?: AutomationFlowAuthoringAdapter;
  runner: AgentRunAdapter;
};

type AutomationFlowAuthoringAdapter = {
  draftAutomationFlow(input: DraftAutomationFlowInput): Promise<AutomationFlowAuthoringResult>;
  repairAutomationFlow(input: RepairAutomationFlowInput): Promise<AutomationFlowAuthoringResult>;
};

type AgentRunAdapter = {
  evaluateAutonomyGate(input: AutonomyGateInput): Promise<AutonomyGateResult>;
  startRun(input: StartRunInput): AsyncIterable<NormalizedAdapterEvent>;
  resumeRun(input: ResumeRunInput): AsyncIterable<NormalizedAdapterEvent>;

  openNativeSession?(input: OpenNativeSessionInput): Promise<void>;
  cancelRun?(input: CancelRunInput): Promise<AdapterCommandResult>;
};
```

Formal automation-flow loading does not call `AutomationFlowAuthoringAdapter`. MDE parses canonical automation-flow Markdown locally through `@mde/automation-flow`. The authoring adapter is only for creating or repairing draft Markdown when the user asks for inference/help. Its output must still pass local parsing and schema validation before the automation-flow can start discovery.

Detection:

```typescript
type AgentCliDetection = {
  installed: boolean;
  executablePath?: string;
  version?: string;
  authenticated: boolean | "unknown";
  authMessageKey?: string;
  technicalAuthMessage?: string;
  errors?: Array<{ code: string; messageKey: string; technicalMessage?: string }>;
};
```

Start and resume inputs:

```typescript
type StartRunInput = {
  runId: string;
  runKind: "discovery" | "task";
  task?: Task;
  discoveredSource?: DiscoveredTaskSource;
  discoveryRequest?: DiscoveryRunRequest;
  originalTaskMarkdown?: string;
  automationFlowSnapshot: AutomationFlowSnapshot;
  phasePlan?: PhasePlan;
  workspaceRoot?: string;
  promptBundle: RunPromptBundle;
  runtimeTools: MdeRuntimeToolManifest;
  adapterSessionId?: string;
};

type ResumeRunInput = {
  runId: string;
  adapterSessionId?: string;
  decisionId: string;
  userInput?: string;
  selectedActionId: string;
  promptBundle: RunPromptBundle;
  runtimeTools: MdeRuntimeToolManifest;
  continuationContext: RunContinuationContext;
};
```

Run prompt bundle:

```typescript
type RunPromptBundle = {
  systemContract: string;
  automationFlowRules: string;
  workspaceRules: string[];
  runKind: "discovery" | "task";
  normalizedTask?: Task;
  discoveredSource?: DiscoveredTaskSource;
  originalTaskMarkdown?: string;
  remoteSourceSnapshot?: RemoteSourceSnapshot;
  phasePlan?: PhasePlan;
  reportingContract: string;
  runtimeToolInstructions: string;
};
```

The original task Markdown is data inside `RunPromptBundle`. It must not override MDE's system/run contract, automation-flow rules, workspace rules, or runtime tool contract.

Discovery output:

```typescript
type DiscoveryRunRequest = {
  automationFlowSnapshot: AutomationFlowSnapshot;
  helperTools: Array<"scan_local_markdown" | "scan_user_prompts" | "remote_provider">;
  workspaceRoot?: string;
};

type DiscoveredTaskSource = {
  sourceItemId: string;
  sourceType: "local-file" | "remote-issue" | "remote-merge-request" | "remote-doc" | "remote-prompt" | "adapter-discovered";
  title: string;
  provider?: "filesystem" | "github" | "gitlab" | "jira" | string;
  sourceUri?: string;
  localPath?: string;
  externalId?: string;
  sourceSnapshotHash: string;
  sourceSnapshotRef: string;
  priority?: number;
  engine?: AgentCliId;
};

type RemoteSourceSnapshot = {
  provider: string;
  sourceUri: string;
  externalId?: string;
  fetchedAt: string;
  contentRef: string;
  contentHash: string;
};
```

Authoring helper inputs:

```typescript
type DraftAutomationFlowInput = {
  scope: "user" | "workspace";
  workspaceRoot?: string;
  userIntent: string;
  sourceHints: string[];
  requiredFields: string[];
};

type RepairAutomationFlowInput = {
  sourceFile: string;
  markdown: string;
  diagnostics: AutomationFlowDiagnostic[];
};

type AutomationFlowAuthoringResult =
  | { ok: true; markdown: string; summary: string }
  | { ok: false; diagnostics: AutomationFlowDiagnostic[] };
```

Autonomy gate inputs:

```typescript
type AutonomyGateInput = {
  runId: string;
  task: Task;
  automationFlowSnapshot: AutomationFlowSnapshot;
  promptBundle: RunPromptBundle;
  workspaceRoot?: string;
};

type AutonomyGateResult = {
  canRunAutonomously: boolean;
  checkedContextSummary: string;
  phasePlan?: PhasePlan;
  decision?: DecisionRequiredPayload;
};
```

## Capability Report

Every adapter must expose a probe result before it can be enabled.

```typescript
type CapabilityLevel = "native" | "adapter-bridge" | "fallback" | "unsupported";

type AgentCliCapabilityReport = {
  adapterId: AgentCliId;
  displayName: string;
  version?: string;
  checkedAt: string;
  verdict: "full" | "limited" | "read-only" | "unsupported";
  capabilities: {
    nonInteractiveRun: CapabilityLevel;
    workingDirectory: CapabilityLevel;
    structuredEventStream: CapabilityLevel;
    schemaConstrainedFinalOutput: CapabilityLevel;
    automationFlowAuthoring: CapabilityLevel;
    autonomyGate: CapabilityLevel;
    mdeRuntimeTools: CapabilityLevel;
    runScopedRuntimeAuthorization: CapabilityLevel;
    sessionId: CapabilityLevel;
    resumeBySessionId: CapabilityLevel;
    continuationSession: CapabilityLevel;
    openNativeSession: CapabilityLevel;
    cancellation: CapabilityLevel;
    permissionMode: CapabilityLevel;
    evidenceCapture: CapabilityLevel;
    fileMutation: CapabilityLevel;
    stdoutJsonlFallback: CapabilityLevel;
  };
  missingRequired: string[];
  warnings: Array<{ code: string; messageKey: string; technicalMessage?: string }>;
  recommendedMode: "full-automation" | "phase-inferred" | "final-report-only" | "disabled";
};
```

V1 desktop implementation note:

The first shippable Automation Center exposes the capability report over IPC as a compact boolean surface instead of the full `CapabilityLevel` enum. Each boolean means the capability is currently usable by the adapter through native support, an MDE bridge, or an accepted fallback. Unsupported capability is `false`.

The V1 run gate requires:

* `mdeRuntimeTools`

* `nonInteractiveRun`

* `runScopedRuntimeAuthorization`

* `structuredEventStream`

* `workingDirectory`

If any required run capability is missing, the adapter registry rejects `startRun` and the UI receives an adapter setup diagnostic. `openNativeSession` remains an optional action: the runtime exposes it only when the adapter reports `openNativeSession: true` and the MDE run has an adapter session id. Runtime-tool authorization is enforced by MDE with run id, token expiry, automation-flow snapshot id, source item id, task id, archived-source, source path, and evidence path checks.

Capability levels mean:

* `native`: the CLI exposes the feature directly.

* `adapter-bridge`: MDE can provide the feature through MCP, wrapper scripts, or JSONL bridge.

* `fallback`: MDE can approximate the feature, but UI must mark it as inferred or limited.

* `unsupported`: the feature is not available.

## Feature Coverage Matrix

| MDE feature                            | Required adapter support                                       | Fallback                                                     |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| Draft/repair automation-flow authoring | structured Markdown result or diagnostics                      | user edits canonical Markdown manually                       |
| Discovery run                          | full native session that emits `DiscoveredTaskSource` records  | unsupported if absent                                        |
| Autonomy gate                          | structured gate result with optional phase-plan refinement     | MDE creates template phase plan and asks user when ambiguous |
| Task run                               | one full native session per task with workspace cwd            | unsupported if absent                                        |
| Phase progress                         | MDE runtime tool calls or structured JSONL phase events        | infer from high-level events and mark inferred               |
| Needs me                               | structured decision event or runtime `request_user_input` tool | final-report-only mode cannot pause safely                   |
| Resume same run                        | native session id and resume, or continuation session support  | continuation session under same MDE `runId`                  |
| Evidence refs                          | runtime `attach_evidence` or adapter JSONL artifact events     | MDE captures file diffs and command outputs it can observe   |
| Final report                           | schema-constrained final output or runtime `write_run_report`  | parse final text only for limited mode                       |
| Open native session                    | CLI supports resume/open by session id                         | show technical evidence only                                 |
| Cancel/pause                           | native cancel/pause or process termination with safe state     | best effort; UI may show `Open run` only                     |
| Safe permissions                       | CLI exposes permission/sandbox controls                        | require explicit user warning before enabling                |

## Enablement Verdicts

`full`:

* can start non-interactive discovery and task sessions

* supports workspace cwd

* can produce structured events or use MDE runtime tools

* supports run-scoped runtime authorization through MCP session scoping, capability token, or equivalent wrapper validation

* supports phase updates, decisions, evidence, and final reports

* exposes native session id and reliable resume or continuation session

`limited`:

* can execute discovery and task sessions and produce final structured output

* lacks reliable live phase updates or same-session resume, so the UI must gate or degrade affected flows

* Flowline may show inferred phase progress

`read-only`:

* can inspect and report, but cannot safely mutate files or execute required workspace commands

`unsupported`:

* cannot run non-interactively, cannot create a usable native session, cannot provide usable output, or cannot operate in a controlled workspace

## Probe Procedure

When adding a new Agent CLI adapter, MDE runs these checks:

1. Detect executable path and version.

2. Check authentication state.

3. Start a real native session with a no-op non-interactive prompt in a temporary workspace and capture its session id.

4. Verify working-directory control.

5. Verify structured output mode.

6. Verify schema-constrained final output or equivalent.

7. Verify optional automation-flow authoring output does not invent missing required fields.

8. Verify discovery output can return at least one valid local fake task and one valid remote fake task in `DiscoveredTaskSource` shape.

9. Verify autonomy-gate output can return either `canRunAutonomously` or a structured decision.

10. Verify task-run output receives the discovered source snapshot and task source content.

11. Verify session id capture and that separate task runs do not share one native session.

12. Verify resume by session id or continuation-session fallback.

13. Verify MDE runtime tool bridge:

* MCP tool registration, or

* wrapper-provided structured JSONL event emission.

14. Verify run-scoped runtime authorization rejects a wrong `runId`, expired token, or disallowed path.

15. Verify phase events:

    * `run.phase_planned`

    * `run.phase_updated`

16. Verify decision event or `request_user_input` tool.

17. Verify evidence attachment path.

18. Verify final report creation.

19. Verify permission/sandbox controls.

20. Produce `AgentCliCapabilityReport`.

The UI should show this report in adapter setup diagnostics before enabling the adapter for automation-flow runs.

## Adapter Bridge Requirements

The preferred bridge is an MDE-local MCP server that exposes:

* `mde.report_phase_planned`

* `mde.report_phase_update`

* `mde.emit_discovered_task_source`

* `mde.request_user_input`

* `mde.attach_evidence`

* `mde.write_run_report`

* `mde.update_task_status`

If a CLI cannot use MCP, the adapter may use stdout JSONL. Each event must validate against `NormalizedAdapterEvent`. Free-form logs are technical evidence only and cannot drive Flowline state by themselves.

The bridge must be run-scoped:

* Each run gets a per-run MCP session or ephemeral capability token.

* Every tool call must include or be bound to `runId`.

* MDE validates `automationFlowSnapshotId`, source item id, workspace root, evidence paths, report paths, and task status updates before writing state.

* A tool call for the wrong run, expired token, archived source, or path outside the allowed roots is rejected and recorded as technical evidence.

* User-visible messages returned by an adapter are mapped to i18n keys or structured diagnostic codes before primary UI rendering.

## Known Adapter Expectations

Codex CLI:

* expected to create a real native session for each discovery run and each task run

* expected to use `--output-schema` for final structured output

* expected to use `codex exec resume` when native resume is available

* should receive MDE runtime tools through Codex MCP configuration

* may provide automation-flow draft/repair authoring when structured output is available, but formal flow loading remains local

Claude Code:

* expected to create a real native session for each discovery run and each task run

* expected to use `--json-schema` for final structured output

* expected to use `--resume` or `--session-id` for native session continuity

* should receive MDE runtime tools through `--mcp-config`

* may provide automation-flow draft/repair authoring when structured output is available, but formal flow loading remains local

Any future adapter must produce the same MDE-normalized events even if its native CLI output format differs.
