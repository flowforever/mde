import { mkdir, readFile, readdir, readlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const seedLegacyAutomationFixture = async (input: {
  workspaceRoot: string; homeRoot: string; userDataRoot: string;
}): Promise<readonly string[]> => {
  const { workspaceRoot, homeRoot, userDataRoot } = input;
  const files: readonly (readonly [string, string])[] = [
    [join(workspaceRoot, '.mde/automation-flows/legacy.md'), '# Legacy flow\n'],
    [join(workspaceRoot, '.mde/automation-flows/legacy/execute.md'), '# Legacy executor\n'],
    [join(workspaceRoot, '.mde/automation-flows/archived/older.md'), '# Archived legacy flow\n'],
    [join(workspaceRoot, '.mde/automation-flows/.applied-global-flows.json'), '{"flowIds":["legacy"]}\n'],
    [join(workspaceRoot, '.mde/docs/tasks/ready-legacy.md'), '# READY Legacy task\n'],
    [join(homeRoot, '.mde/automation-flows/global.md'), '# Global legacy flow\n'],
    [join(userDataRoot, 'automation/runtime-owner.json'), '{"ownerId":"old-owner","processId":0}\n'],
    [join(userDataRoot, 'automation/runs/broken.json'), '{broken'],
    [join(userDataRoot, 'automation/reports/old.md'), '# Old report\n'],
    [join(userDataRoot, 'automation/automation-flow-runtime/old-lock.json'), '{"state":"running"}\n'],
  ];
  for (const [path, content] of files) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf8');
  }
  const roots = [
    join(workspaceRoot, '.mde/automation-flows'), join(workspaceRoot, '.mde/docs'),
    join(homeRoot, '.mde/automation-flows'), join(userDataRoot, 'automation'),
    join(homeRoot, '.codex/skills'), join(homeRoot, '.agents/skills'),
  ];
  for (const root of roots) await mkdir(root, { recursive: true });
  return roots;
};

export const snapshotTree = async (root: string): Promise<Record<string, string>> => {
  const snapshot: Record<string, string> = {};
  const visit = async (relativePath: string): Promise<void> => {
    const entries = await readdir(join(root, relativePath), { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const relative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const path = join(root, relative);
      if (entry.isSymbolicLink()) snapshot[`link:${relative}`] = await readlink(path);
      else if (entry.isDirectory()) {
        snapshot[`dir:${relative}`] = '';
        await visit(relative);
      } else snapshot[`file:${relative}`] = (await readFile(path)).toString('base64');
    }
  };
  try { await visit(''); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { 'missing:root': '' };
  }
  return snapshot;
};
