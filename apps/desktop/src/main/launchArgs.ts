import { resolve } from 'node:path'

const isInternalLaunchArgument = (argument: string): boolean =>
  argument.length === 0 ||
  argument.startsWith('--') ||
  argument === 'out/main/index.js' ||
  argument === 'out\\main\\index.js' ||
  argument.endsWith('/out/main/index.js') ||
  argument.endsWith('\\out\\main\\index.js')

export const getLaunchPathFromArgv = (
  argv: readonly string[] = process.argv,
  cwd: string = process.cwd()
): string | null => {
  const candidate = argv.slice(1).find((argument) => {
    if (isInternalLaunchArgument(argument)) {
      return false
    }

    return !argument.endsWith('.app/Contents/MacOS/MDE')
  })

  return candidate ? resolve(cwd, candidate) : null
}
