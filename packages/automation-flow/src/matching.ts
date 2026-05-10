import type {
  AutomationFlow,
  AutomationFlowSourceItem,
  AutomationFlowTaskCandidate
} from './types'

const normalizePath = (path: string): string =>
  path.replace(/\\/gu, '/').replace(/^\.\//u, '').replace(/^\/+/u, '')

const hasPathSegment = (path: string, segment: string): boolean =>
  normalizePath(path).split('/').includes(segment)

const escapeRegExpCharacter = (character: string): string =>
  /[\\^$+?.()|[\]{}]/u.test(character) ? `\\${character}` : character

const globToRegExp = (glob: string): RegExp => {
  const normalizedGlob = normalizePath(glob)
  let pattern = ''

  for (let index = 0; index < normalizedGlob.length; index += 1) {
    const character = normalizedGlob[index]
    const nextCharacter = normalizedGlob[index + 1]
    const nextNextCharacter = normalizedGlob[index + 2]

    if (character === '*' && nextCharacter === '*') {
      if (nextNextCharacter === '/') {
        pattern += '(?:.*/)?'
        index += 2
      } else {
        pattern += '.*'
        index += 1
      }
      continue
    }

    if (character === '*') {
      pattern += '[^/]*'
      continue
    }

    pattern += escapeRegExpCharacter(character)
  }

  return new RegExp(`^${pattern}$`, 'u')
}

const matchesAnyGlob = (
  relativePath: string | undefined,
  globs: readonly string[] | undefined
): boolean => {
  if (relativePath === undefined) {
    return globs === undefined || globs.length === 0
  }

  if (globs === undefined || globs.length === 0) {
    return true
  }

  const normalizedRelativePath = normalizePath(relativePath)

  return globs.some((glob) => globToRegExp(glob).test(normalizedRelativePath))
}

const matchesAnyTitleInclude = (
  title: string,
  titleIncludes: readonly string[] | undefined
): boolean => {
  if (titleIncludes === undefined || titleIncludes.length === 0) {
    return true
  }

  const normalizedTitle = title.toLowerCase()

  return titleIncludes.some((titleInclude) =>
    normalizedTitle.includes(titleInclude.toLowerCase())
  )
}

const matchesAnyTag = (
  sourceTags: readonly string[] | undefined,
  promptTags: readonly string[] | undefined
): boolean => {
  if (promptTags === undefined || promptTags.length === 0) {
    return true
  }

  if (sourceTags === undefined || sourceTags.length === 0) {
    return false
  }

  const normalizedSourceTags = new Set(
    sourceTags.map((tag) => tag.toLowerCase())
  )

  return promptTags.some((tag) => normalizedSourceTags.has(tag.toLowerCase()))
}

const isMarkdownPath = (relativePath: string | undefined): boolean =>
  relativePath === undefined || normalizePath(relativePath).endsWith('.md')

const isReadyTitle = (title: string): boolean =>
  title.trim().toLowerCase().startsWith('ready')

const isActiveSourceItem = (sourceItem: AutomationFlowSourceItem): boolean => {
  if (sourceItem.automationStatus === 'ready') {
    return true
  }

  if (sourceItem.automationStatus !== undefined) {
    return false
  }

  return (
    sourceItem.sourceType === 'workspace-markdown' &&
    isReadyTitle(sourceItem.title)
  )
}

export const matchesAutomationFlowSourceItem = (
  automationFlow: AutomationFlow,
  sourceItem: AutomationFlowSourceItem
): boolean => {
  if (
    automationFlow.lifecycle !== 'enabled' ||
    !automationFlow.sourceTypes.includes(sourceItem.sourceType) ||
    !isActiveSourceItem(sourceItem) ||
    !isMarkdownPath(sourceItem.relativePath)
  ) {
    return false
  }

  if (
    sourceItem.relativePath !== undefined &&
    (hasPathSegment(sourceItem.relativePath, 'done') ||
      hasPathSegment(sourceItem.relativePath, 'archived'))
  ) {
    return false
  }

  if (
    sourceItem.sourceType === 'workspace-markdown' &&
    !matchesAnyGlob(sourceItem.relativePath, automationFlow.match.taskPathGlobs)
  ) {
    return false
  }

  if (
    sourceItem.sourceType === 'user-prompt' &&
    !matchesAnyTag(sourceItem.tags, automationFlow.match.promptTags)
  ) {
    return false
  }

  return (
    sourceItem.sourceType === 'workspace-markdown' &&
    sourceItem.automationStatus === 'ready'
  ) || matchesAnyTitleInclude(sourceItem.title, automationFlow.match.titleIncludes)
}

export const createAutomationFlowTaskCandidate = (
  automationFlow: AutomationFlow,
  sourceItem: AutomationFlowSourceItem
): AutomationFlowTaskCandidate | null => {
  if (!matchesAutomationFlowSourceItem(automationFlow, sourceItem)) {
    return null
  }

  const engine =
    sourceItem.engine !== undefined &&
    automationFlow.allowedEngines.includes(sourceItem.engine)
      ? sourceItem.engine
      : automationFlow.defaultEngine

  return Object.freeze({
    automationFlowId: automationFlow.id,
    engine,
    priority: sourceItem.priority,
    relativePath: sourceItem.relativePath,
    sourceItemId: sourceItem.sourceItemId,
    sourcePath: sourceItem.sourcePath,
    sourceType: sourceItem.sourceType,
    taskId: `${automationFlow.id}:${sourceItem.sourceItemId}`,
    title: sourceItem.title,
    workspaceId: sourceItem.workspaceId
  })
}

const getPickOrderIndex = (
  automationFlow: AutomationFlow,
  candidate: AutomationFlowTaskCandidate
): number => {
  if (
    candidate.relativePath === undefined ||
    automationFlow.pickOrder.length === 0
  ) {
    return Number.POSITIVE_INFINITY
  }

  const normalizedRelativePath = normalizePath(candidate.relativePath)
  const index = automationFlow.pickOrder.findIndex((glob) =>
    globToRegExp(glob).test(normalizedRelativePath)
  )

  return index === -1 ? Number.POSITIVE_INFINITY : index
}

export const orderAutomationFlowTaskCandidates = (
  automationFlow: AutomationFlow,
  candidates: readonly AutomationFlowTaskCandidate[]
): readonly AutomationFlowTaskCandidate[] =>
  Object.freeze(
    [...candidates].sort((left, right) => {
      const pickOrderDelta =
        getPickOrderIndex(automationFlow, left) -
        getPickOrderIndex(automationFlow, right)

      if (pickOrderDelta !== 0) {
        return pickOrderDelta
      }

      const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0)

      if (priorityDelta !== 0) {
        return priorityDelta
      }

      return left.sourceItemId.localeCompare(right.sourceItemId)
    })
  )
