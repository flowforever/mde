import { cp, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const createFixtureWorkspace = async (): Promise<string> => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'mde-e2e-workspace-'))

  await cp(resolve('tests/fixtures/workspace'), workspacePath, {
    recursive: true
  })

  return workspacePath
}
