#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const currentFilePath = fileURLToPath(import.meta.url)
const projectRoot = resolve(dirname(currentFilePath), '..')

const createLaunchPathArgs = (args, cwd) =>
  args.filter((arg) => arg !== '--dry-run').map((arg) => resolve(cwd, arg))

const getMacAppPath = () => {
  if (process.env.MDE_APP_PATH) {
    return process.env.MDE_APP_PATH
  }

  const candidates = [
    '/Applications/MDE.app',
    `${process.env.HOME ?? ''}/Applications/MDE.app`,
    resolve(projectRoot, 'release/mac-arm64/MDE.app'),
    resolve(projectRoot, 'release/mac/MDE.app')
  ].filter(Boolean)

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

const getElectronBinaryPath = () => {
  const binaryName = process.platform === 'win32' ? 'electron.cmd' : 'electron'
  const binaryPath = resolve(projectRoot, 'node_modules/.bin', binaryName)

  return existsSync(binaryPath) ? binaryPath : null
}

const createLaunchCommand = (args, cwd = process.cwd()) => {
  const launchPathArgs = createLaunchPathArgs(args, cwd)

  if (process.platform === 'darwin') {
    const appPath = getMacAppPath()

    return {
      args:
        launchPathArgs.length > 0
          ? ['-na', appPath, '--args', ...launchPathArgs]
          : ['-na', appPath],
      command: 'open'
    }
  }

  const appPath = process.env.MDE_APP_PATH
  if (appPath) {
    return {
      args: launchPathArgs,
      command: appPath
    }
  }

  const electronPath = getElectronBinaryPath()
  if (!electronPath) {
    throw new Error(
      'Unable to locate MDE. Install the app or set MDE_APP_PATH to the app executable.'
    )
  }

  return {
    args: [resolve(projectRoot, 'apps/desktop/out/main/index.js'), ...launchPathArgs],
    command: electronPath
  }
}

const run = () => {
  const args = process.argv.slice(2)
  const command = createLaunchCommand(args)

  if (args.includes('--dry-run')) {
    process.stdout.write(`${JSON.stringify(command)}\n`)
    return
  }

  const child = spawn(command.command, command.args, {
    detached: true,
    stdio: 'ignore'
  })

  child.unref()
}

run()
