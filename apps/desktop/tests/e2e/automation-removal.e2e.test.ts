import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { buildElectronApp } from './support/electronApp';
import { createElectronLaunchEnv } from './support/e2eLaunchEnv';
import { createFixtureWorkspace } from './support/fixtureWorkspace';
import { seedLegacyAutomationFixture, snapshotTree } from './support/legacyAutomationFixture';

test.setTimeout(120_000);
test.beforeAll(async ({ browserName }, testInfo) => {
  void browserName;
  testInfo.setTimeout(900_000);
  await buildElectronApp();
});

for (const installedHelper of [false, true]) {
test(`preserves legacy automation data after shutdown (installed helper: ${installedHelper})`, async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'mde-retired-flow-'));
  const originalWorkspace = await createFixtureWorkspace();
  const workspaceRoot = join(fixtureRoot, 'workspace 空间');
  const homeRoot = join(fixtureRoot, 'home');
  const userDataRoot = join(fixtureRoot, 'user-data');
  // Copy the standard workspace so this test has its own Unicode path.
  const { cp } = await import('node:fs/promises');
  await cp(originalWorkspace, workspaceRoot, { recursive: true });
  await mkdir(homeRoot, { recursive: true });
  await mkdir(userDataRoot, { recursive: true });
  const protectedRoots = await seedLegacyAutomationFixture({ workspaceRoot, homeRoot, userDataRoot });
  if (installedHelper) {
    const source = join(homeRoot, 'legacy-helper');
    await mkdir(source, { recursive: true });
    await writeFile(join(source, 'SKILL.md'), '# User-installed helper\n');
    await symlink(source, join(homeRoot, '.codex/skills/automation-flow-helper'), process.platform === 'win32' ? 'junction' : 'dir');
  }
  const before = await Promise.all(protectedRoots.map(snapshotTree));
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({
      args: ['--lang=en-US', 'apps/desktop/out/main/index.js', workspaceRoot],
      env: createElectronLaunchEnv({
        e2eUserDataPath: userDataRoot,
        overrideEnv: {
          MDE_E2E_HOME_PATH: homeRoot,
          MDE_DISABLE_AUTO_UPDATE: '1',
          MDE_E2E_AGENT_CHAT_FAKE_CODEX: '1',
        },
      }),
    });
    let startupOutput = '';
    app.process().stderr?.on('data', (chunk: Buffer) => { startupOutput += chunk.toString(); });
    const window = await app.firstWindow().catch((error: unknown) => {
      throw new Error(`${String(error)}\n${startupOutput}`);
    });
    await window.locator('.app-shell').waitFor({ state: 'visible', timeout: 20_000 });
    await expect(window.getByRole('button', { name: /README\.md/ }).first()).toBeVisible();
    await window.evaluate(() => localStorage.setItem('mde.appLanguagePreference', 'en'));
    await window.reload({ waitUntil: 'domcontentloaded' });
    expect(await window.evaluate(() => 'mdeAutomation' in globalThis)).toBe(false);
    expect(await window.evaluate(() => 'openAutomationCenter' in (globalThis.window.mdeWindow ?? {}))).toBe(false);
    await expect(window.locator('[data-component-id^="automation."]')).toHaveCount(0);
    await expect(window.locator('[data-component-id="explorer.automation-flows-panel"]')).toHaveCount(0);
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click();
    const editor = window.getByTestId('markdown-block-editor').locator('[contenteditable="true"]').first();
    await editor.click();
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Saved after Automation Flow removal');
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S');
    await expect.poll(() => readFile(join(workspaceRoot, 'README.md'), 'utf8')).toContain('Saved after Automation Flow removal');
    await window.reload({ waitUntil: 'domcontentloaded' });
    await expect(window.getByTestId('markdown-block-editor')).toContainText('Saved after Automation Flow removal');
    await app.close();
    app = undefined;
    expect(await Promise.all(protectedRoots.map(snapshotTree))).toEqual(before);
  } finally {
    await app?.close();
    await rm(fixtureRoot, { recursive: true, force: true });
    await rm(originalWorkspace, { recursive: true, force: true });
  }
});
}


test('does not initialize automation storage or install a helper in an empty profile', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'mde-empty-profile-'));
  const workspaceRoot = await createFixtureWorkspace();
  const homeRoot = join(fixtureRoot, 'home');
  const userDataRoot = join(fixtureRoot, 'user-data');
  await mkdir(homeRoot, { recursive: true });
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({
      args: ['--lang=en-US', 'apps/desktop/out/main/index.js', workspaceRoot],
      env: createElectronLaunchEnv({ e2eUserDataPath: userDataRoot, overrideEnv: {
        MDE_E2E_HOME_PATH: homeRoot, MDE_DISABLE_AUTO_UPDATE: '1', MDE_E2E_AGENT_CHAT_FAKE_CODEX: '1',
      } }),
    });
    let startupOutput = '';
    app.process().stderr?.on('data', (chunk: Buffer) => { startupOutput += chunk.toString(); });
    const window = await app.firstWindow().catch((error: unknown) => {
      throw new Error(`${String(error)}\n${startupOutput}`);
    });
    await expect(window.getByRole('button', { name: /README\.md/ }).first()).toBeVisible();
    await app.close();
    app = undefined;
    for (const root of [join(userDataRoot, 'automation'), join(homeRoot, '.codex/skills/automation-flow-helper'), join(homeRoot, '.agents/skills/automation-flow-helper')]) {
      expect(await snapshotTree(root)).toEqual({ 'missing:root': '' });
    }
  } finally {
    await app?.close();
    await rm(fixtureRoot, { recursive: true, force: true });
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
