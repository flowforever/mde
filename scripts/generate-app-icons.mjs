#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceSvgPath = resolve(
  repositoryRoot,
  'docs/superpowers/prototypes/app-icon-assets/mde-icon-split-editor.svg'
)
const buildDirectory = resolve(repositoryRoot, 'build')
const outputSvgPath = join(buildDirectory, 'icon.svg')
const outputPngPath = join(buildDirectory, 'icon.png')
const outputIcnsPath = join(buildDirectory, 'icon.icns')
const outputIcoPath = join(buildDirectory, 'icon.ico')
const iconsetDirectory = join(buildDirectory, 'icon.iconset')
const icoSourcesDirectory = join(buildDirectory, 'icon.ico.sources')

const icnsEntries = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024]
]
const icoSizes = [16, 24, 32, 48, 64, 128, 256]

const run = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe'
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        result.stdout.trim(),
        result.stderr.trim()
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  return result.stdout
}

const assertTool = (toolName) => {
  try {
    run('which', [toolName])
  } catch {
    throw new Error(
      `Missing required tool "${toolName}". Regenerate icons on macOS with Xcode command line tools installed.`
    )
  }
}

const createIcoBuffer = (images) => {
  const headerLength = 6
  const directoryEntryLength = 16
  const directoryLength = images.length * directoryEntryLength
  const header = Buffer.alloc(headerLength)
  const directory = Buffer.alloc(directoryLength)
  let imageOffset = headerLength + directoryLength

  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  images.forEach((image, imageIndex) => {
    const directoryOffset = imageIndex * directoryEntryLength

    directory[directoryOffset] = image.size === 256 ? 0 : image.size
    directory[directoryOffset + 1] = image.size === 256 ? 0 : image.size
    directory[directoryOffset + 2] = 0
    directory[directoryOffset + 3] = 0
    directory.writeUInt16LE(1, directoryOffset + 4)
    directory.writeUInt16LE(32, directoryOffset + 6)
    directory.writeUInt32LE(image.contents.byteLength, directoryOffset + 8)
    directory.writeUInt32LE(imageOffset, directoryOffset + 12)
    imageOffset += image.contents.byteLength
  })

  return Buffer.concat([header, directory, ...images.map((image) => image.contents)])
}

const resizePng = (size, outputPath) => {
  run('sips', [
    '-z',
    String(size),
    String(size),
    outputPngPath,
    '--out',
    outputPath
  ])
}

const main = async () => {
  assertTool('sips')
  assertTool('iconutil')

  await mkdir(buildDirectory, { recursive: true })
  await cp(sourceSvgPath, outputSvgPath)
  run('sips', ['-s', 'format', 'png', outputSvgPath, '--out', outputPngPath])

  await rm(iconsetDirectory, { force: true, recursive: true })
  await mkdir(iconsetDirectory, { recursive: true })

  for (const [filename, size] of icnsEntries) {
    resizePng(size, join(iconsetDirectory, filename))
  }

  run('iconutil', ['-c', 'icns', iconsetDirectory, '-o', outputIcnsPath])
  await rm(iconsetDirectory, { force: true, recursive: true })

  await rm(icoSourcesDirectory, { force: true, recursive: true })
  await mkdir(icoSourcesDirectory, { recursive: true })

  const icoImages = []
  for (const size of icoSizes) {
    const sourcePath = join(icoSourcesDirectory, `icon-${size}.png`)

    resizePng(size, sourcePath)
    icoImages.push({
      contents: await readFile(sourcePath),
      size
    })
  }

  await writeFile(outputIcoPath, createIcoBuffer(icoImages))
  await rm(icoSourcesDirectory, { force: true, recursive: true })
}

await main()
