import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const appPath = join(process.cwd(), 'apps/desktop/src/renderer/src/app/App.tsx')
const aiResultPanelPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/ai/AiResultPanel.tsx'
)

describe('AI result editor search integration', () => {
  it('routes editor search state from the app into read-only AI result editors', async () => {
    const [app, aiResultPanel] = await Promise.all([
      readFile(appPath, 'utf8'),
      readFile(aiResultPanelPath, 'utf8')
    ])

    expect(app).toContain('onSearchStateChange={setEditorSearchState}')
    expect(app).toContain('searchQuery={editorSearchQuery}')
    expect(app).toContain('searchState={editorSearchState}')
    expect(aiResultPanel).toContain(
      'activeSearchMatchIndex={searchState.activeMatchIndex}'
    )
    expect(aiResultPanel).toContain('onSearchStateChange={onSearchStateChange}')
    expect(aiResultPanel).toContain('pinnedSearchQueries={pinnedSearchQueries}')
    expect(aiResultPanel).toContain('searchQuery={searchQuery}')
  })
})
