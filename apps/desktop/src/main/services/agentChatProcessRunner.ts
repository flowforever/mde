import { execFile as nodeExecFile, spawn as nodeSpawn } from 'node:child_process'
import { delimiter, dirname } from 'node:path'
import { promisify } from 'node:util'

import type {
  AgentChatChildProcess,
  AgentChatProcessRunner
} from '@mde/agent-chat'

const execFileAsync = promisify(nodeExecFile)

type ResolveShellPath = () => Promise<string | null>

interface NodeAgentChatProcessRunnerOptions {
  readonly resolveShellPath?: ResolveShellPath
}

const unique = (values: readonly string[]): readonly string[] =>
  values.filter(
    (value, index, collection) =>
      value.length > 0 && collection.indexOf(value) === index
  )

const mergePathValues = (
  ...pathValues: readonly (string | null | undefined)[]
): string =>
  unique(
    pathValues.flatMap((pathValue) =>
      pathValue
        ? pathValue
            .split(delimiter)
            .map((entry) => entry.trim())
            .filter(Boolean)
        : []
    )
  ).join(delimiter)

const getShellCandidates = (): readonly string[] => {
  if (process.platform === 'win32') {
    return []
  }

  return unique([process.env.SHELL, '/bin/zsh', '/bin/bash'].map((value) => value ?? ''))
}

const defaultResolveShellPath = async (): Promise<string | null> => {
  for (const shellPath of getShellCandidates()) {
    try {
      const { stdout } = await execFileAsync(
        shellPath,
        ['-lc', 'printf %s "$PATH"'],
        { timeout: 3000 }
      )
      const resolvedPath = stdout.trim()

      if (resolvedPath.length > 0) {
        return resolvedPath
      }
    } catch {
      // Try the next common login shell.
    }
  }

  return null
}

const mergeEnvironment = (
  shellPath: string | null,
  overrideEnv?: NodeJS.ProcessEnv
): NodeJS.ProcessEnv => {
  const baseEnv = overrideEnv ? { ...process.env, ...overrideEnv } : { ...process.env }
  const mergedPath = mergePathValues(
    shellPath,
    overrideEnv?.PATH ?? overrideEnv?.Path,
    process.env.PATH ?? process.env.Path,
    dirname(process.execPath)
  )

  return process.platform === 'win32'
    ? { ...baseEnv, PATH: mergedPath, Path: mergedPath }
    : { ...baseEnv, PATH: mergedPath }
}

const createTextIterable = (
  stream: NodeJS.ReadableStream | null
): AsyncIterable<string> => ({
  async *[Symbol.asyncIterator]() {
    if (!stream) {
      return
    }
    for await (const chunk of stream as AsyncIterable<Buffer | string>) {
      yield typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    }
  }
})

export const createNodeAgentChatProcessRunner = (
  options: NodeAgentChatProcessRunnerOptions = {}
): AgentChatProcessRunner => {
  const resolveShellPath = options.resolveShellPath ?? defaultResolveShellPath
  let environmentPromise: Promise<NodeJS.ProcessEnv> | null = null
  let resolvedEnvironment: NodeJS.ProcessEnv | null = null
  const resolveEnvironment = async (): Promise<NodeJS.ProcessEnv> => {
    if (resolvedEnvironment) {
      return resolvedEnvironment
    }

    environmentPromise ??= resolveShellPath()
      .then((shellPath) => {
        const environment = mergeEnvironment(shellPath)
        if (shellPath) {
          resolvedEnvironment = environment
        }
        return environment
      })
      .finally(() => {
        environmentPromise = null
      })

    return environmentPromise
  }

  return {
    execFile: async (command, args, runnerOptions) => {
      const env = mergeEnvironment(null, await resolveEnvironment())
      const result = await execFileAsync(command, [...args], {
        cwd: runnerOptions?.cwd,
        env,
        timeout: runnerOptions?.timeoutMs
      })

      return {
        stderr: result.stderr?.toString() ?? '',
        stdout: result.stdout?.toString() ?? ''
      }
    },
    spawn: (command, args, runnerOptions): AgentChatChildProcess => {
      const child = nodeSpawn(command, [...args], {
        cwd: runnerOptions?.cwd,
        env: mergeEnvironment(null, {
          ...(resolvedEnvironment ?? process.env),
          ...runnerOptions?.env
        }),
        stdio: ['pipe', 'pipe', 'pipe']
      })

      return {
        kill: () => {
          child.kill()
        },
        stderr: createTextIterable(child.stderr),
        stdin: {
          end: () => {
            child.stdin.end()
          },
          write: (chunk) => {
            child.stdin.write(chunk)
          }
        },
        stdout: createTextIterable(child.stdout)
      }
    }
  }
}
