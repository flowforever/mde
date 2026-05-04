import { describe, expect, it } from 'vitest'

import { EDITOR_COMPONENT_IDS } from '@mde/editor-react'

const componentIdPattern = /^(editor|link|flowchart)\.[a-z0-9]+(?:-[a-z0-9]+)*$/u

const collectComponentIds = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value]
  }

  if (value === null || typeof value !== 'object') {
    return []
  }

  return Object.values(value).flatMap(collectComponentIds)
}

describe('editor-react component ids', () => {
  it('exports stable editor-scoped component ids for host consumers', () => {
    const componentIds = collectComponentIds(EDITOR_COMPONENT_IDS)

    expect(componentIds.length).toBeGreaterThan(30)
    expect(new Set(componentIds).size).toBe(componentIds.length)

    for (const componentId of componentIds) {
      expect(componentId).toMatch(componentIdPattern)
    }
  })
})
