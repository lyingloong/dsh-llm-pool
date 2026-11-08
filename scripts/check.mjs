#!/usr/bin/env node
/**
 * Static repository checks that do not require a DSH installation.
 *
 * - validates the package manifest and the files the bundle relies on
 * - syntax-checks every authored ESM file with `node --check`
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('..', import.meta.url))
const failures = []

function fail(message) {
  failures.push(message)
}

function checkFile(path, label = path) {
  if (!existsSync(join(root, path))) fail(`missing ${label}: ${path}`)
}

function checkDirectory(path) {
  if (!existsSync(join(root, path))) fail(`missing directory: ${path}`)
}

let manifest
try {
  manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
} catch (error) {
  fail(`package.json is not valid JSON: ${String(error)}`)
}

if (manifest !== undefined) {
  if (manifest.name !== 'dsh-llm-pool') fail('package.json name must be dsh-llm-pool')
  if (manifest.type !== 'module') fail('package.json type must be module')
  if (typeof manifest.version !== 'string' || manifest.version.length === 0) fail('package.json version is missing')
  if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') fail('package.json must declare dsh.bundle.patch')
  if (manifest.dsh?.client?.platform !== 'web') fail('package.json must declare dsh.client.platform=web')
  if (manifest.engines?.dsh === undefined) fail('package.json must declare engines.dsh')
  if (typeof manifest.icon === 'string') checkFile(manifest.icon.replace(/^\.\//, ''), 'package icon')
  for (const path of Object.values(manifest.exports ?? {})) {
    if (typeof path === 'string' && path.startsWith('./')) checkFile(path.slice(2))
  }
  for (const path of manifest.files ?? []) {
    const clean = path.endsWith('/') ? path.slice(0, -1) : path
    if (path.endsWith('/')) checkDirectory(clean)
    else checkFile(clean)
  }
}

checkFile('cordis.patch.yml')
checkFile('docs/demo.md')
checkFile('docs/market.md')
checkFile('docs/assets/icon.svg')
checkFile('docs/assets/icon.png')
checkFile('site/index.html')
checkFile('site/styles.css')
checkFile('.github/workflows/pages.yml')

const landing = existsSync(join(root, 'site/index.html')) ? readFileSync(join(root, 'site/index.html'), 'utf8') : ''
if (!landing.includes('dsh plugin --profile web add dsh-llm-pool')) {
  fail('site/index.html must show the npm install command')
}
const patch = existsSync(join(root, 'cordis.patch.yml')) ? readFileSync(join(root, 'cordis.patch.yml'), 'utf8') : ''
if (!patch.includes('id: llm-pool') || !patch.includes('name: dsh-llm-pool')) {
  fail('cordis.patch.yml must insert the llm-pool / dsh-llm-pool entry')
}

function collect(directory) {
  const found = []
  if (!existsSync(join(root, directory))) return found
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const rel = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...collect(rel))
    else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) found.push(rel)
  }
  return found
}

const files = [
  'index.js',
  'client.js',
  'scripts/check.mjs',
  ...collect('lib'),
  ...collect('test'),
].filter((path, index, list) => list.indexOf(path) === index)

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    fail(`syntax check failed: ${file}\n${result.stderr ?? ''}`)
  }
}

if (failures.length > 0) {
  for (const message of failures) console.error(`check: ${message}`)
  process.exitCode = 1
} else {
  console.log(`check ok: ${files.length} ESM files, package manifest, bundle patch`)
  console.log(`checked from ${relative(process.cwd(), root) || '.'}`)
}
