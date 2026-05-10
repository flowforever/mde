import { z } from 'zod'

import type { AutomationFlow } from './types'

const nonEmptyStringSchema = z.string().trim().min(1)

export const automationFlowScopeSchema = z.enum(['user', 'workspace'])

export const automationFlowStatusSchema = z.enum(['formal', 'draft'])

export const automationFlowLifecycleSchema = z
  .enum(['enabled', 'disabled', 'archived'])
  .default('enabled')

export const automationFlowSourceTypeSchema = z.enum([
  'adapter-discovered',
  'local-file',
  'remote-doc',
  'remote-issue',
  'remote-mr',
  'workspace-markdown',
  'user-prompt'
])

export const automationFlowMatchSchema = z
  .object({
    promptTags: z.array(nonEmptyStringSchema).optional(),
    taskPathGlobs: z.array(nonEmptyStringSchema).optional(),
    titleIncludes: z.array(nonEmptyStringSchema).optional()
  })
  .default({})

export const automationFlowLoopPolicySchema = z.object({
  intervalMinutes: z.number().int().positive().default(15),
  maxActiveRuns: z.number().int().positive().default(1),
  mode: z.enum(['continuous', 'manual']),
  onBlocked: z
    .enum(['skip-and-continue', 'pause-automation-flow'])
    .default('skip-and-continue'),
  onEmpty: z.enum(['wait', 'stop']).default('wait')
})

export const automationFlowConfirmationPolicySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    fileWrites: z
      .enum(['automation-flow-controlled', 'require-user', 'allow'])
      .default('automation-flow-controlled'),
    highRisk: z.enum(['require-user', 'allow']).default('require-user'),
    unclearScope: z.enum(['require-user', 'allow']).default('require-user')
  })
)

export const automationFlowSectionsSchema = z.object({
  acceptanceStandard: nonEmptyStringSchema,
  executionStandard: nonEmptyStringSchema,
  pickRules: nonEmptyStringSchema,
  reportPattern: nonEmptyStringSchema,
  verificationExpectations: nonEmptyStringSchema
})

export const automationFlowSchema = z
  .object({
    allowedEngines: z.array(nonEmptyStringSchema).min(1),
    confirmationPolicy: automationFlowConfirmationPolicySchema,
    defaultEngine: nonEmptyStringSchema,
    id: nonEmptyStringSchema,
    lifecycle: automationFlowLifecycleSchema,
    loopPolicy: automationFlowLoopPolicySchema,
    match: automationFlowMatchSchema,
    name: nonEmptyStringSchema,
    pickOrder: z.array(nonEmptyStringSchema).default([]),
    priority: z.number().int().default(0),
    reportPattern: nonEmptyStringSchema,
    scope: automationFlowScopeSchema,
    sections: automationFlowSectionsSchema,
    sourceTypes: z.array(automationFlowSourceTypeSchema).min(1),
    status: automationFlowStatusSchema
  })
  .superRefine((automationFlow, context) => {
    if (!automationFlow.allowedEngines.includes(automationFlow.defaultEngine)) {
      context.addIssue({
        code: 'custom',
        message: 'defaultEngine must be listed in allowedEngines',
        path: ['defaultEngine']
      })
    }
  })

export const isAutomationFlow = (value: unknown): value is AutomationFlow =>
  automationFlowSchema.safeParse(value).success
