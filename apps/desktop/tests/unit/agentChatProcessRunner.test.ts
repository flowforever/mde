import { chmod, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { createNodeAgentChatProcessRunner } from '../../src/main/services/agentChatProcessRunner'

const AGENT_CHAT_PROCESS_RUNNER_TIMEOUT_MS = 60_000

const shellQuote = (value: string): string =>
  `'${value.replace(/'/gu, "'\\''")}'`

const readAll = async (stream: AsyncIterable<string>): Promise<string> => {
  let output = ''
  for await (const chunk of stream) {
    output += chunk
  }
  return output
}

describe('agentChatProcessRunner', () => {
  it(
    'runs Agent Chat CLIs with the resolved shell PATH for packaged GUI launches',
    async () => {
      const binPath = await mkdtemp(join(tmpdir(), 'mde-agent-chat-bin-'))
      const shellPath = await mkdtemp(join(tmpdir(), 'mde-agent-chat-shell-path-'))
      const fakeInterpreterPath = join(shellPath, 'mde-test-node')
      const fakeCodexPath = join(binPath, 'codex')
      const previousPath = process.env.PATH

      await writeFile(
        fakeInterpreterPath,
        `#!/bin/sh\nexec ${shellQuote(process.execPath)} "$@"\n`,
        'utf8'
      )
      await chmod(fakeInterpreterPath, 0o755)
      await writeFile(
        fakeCodexPath,
        [
          '#!/usr/bin/env mde-test-node',
          'if (process.argv.includes("--version")) {',
          '  process.stdout.write("codex-cli 0.130.0\\n")',
          '  process.exit(0)',
          '}',
          'process.stdin.resume()',
          'process.stdin.on("data", (chunk) => {',
          '  process.stdout.write(`spawn:${chunk.toString()}`)',
          '  process.exit(0)',
          '})',
          ''
        ].join('\n'),
        'utf8'
      )
      await chmod(fakeCodexPath, 0o755)
      process.env.PATH = ['/usr/bin', '/bin'].join(delimiter)

      try {
        const runner = createNodeAgentChatProcessRunner({
          resolveShellPath: () => Promise.resolve(`${binPath}${delimiter}${shellPath}`)
        })

        await expect(runner.execFile('codex', ['--version'])).resolves.toEqual({
          stderr: '',
          stdout: 'codex-cli 0.130.0\n'
        })

        const child = runner.spawn('codex', [])
        child.stdin.write('hello')
        child.stdin.end()

        await expect(readAll(child.stdout)).resolves.toBe('spawn:hello')
      } finally {
        process.env.PATH = previousPath
      }
    },
    AGENT_CHAT_PROCESS_RUNNER_TIMEOUT_MS
  )

  it(
    'retries login-shell PATH resolution after a transient miss',
    async () => {
      const binPath = await mkdtemp(join(tmpdir(), 'mde-agent-chat-bin-'))
      const fakeCommandPath = join(binPath, 'mde-agent-chat-retry-codex')
      const previousPath = process.env.PATH

      await writeFile(
        fakeCommandPath,
        '#!/bin/sh\nprintf "%s\\n" "codex-cli 0.130.0"\n',
        'utf8'
      )
      await chmod(fakeCommandPath, 0o755)
      process.env.PATH = ['/usr/bin', '/bin'].join(delimiter)

      try {
        const resolveShellPath = vi
          .fn<() => Promise<string | null>>()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(binPath)
        const runner = createNodeAgentChatProcessRunner({ resolveShellPath })

        await expect(
          runner.execFile('mde-agent-chat-retry-codex', ['--version'])
        ).rejects.toThrow()
        await expect(
          runner.execFile('mde-agent-chat-retry-codex', ['--version'])
        ).resolves.toEqual({
          stderr: '',
          stdout: 'codex-cli 0.130.0\n'
        })
        expect(resolveShellPath).toHaveBeenCalledTimes(2)
      } finally {
        process.env.PATH = previousPath
      }
    },
    AGENT_CHAT_PROCESS_RUNNER_TIMEOUT_MS
  )
})
