import * as crypto from 'crypto'
import * as cache from '@actions/cache'
import * as glob from '@actions/glob'
import * as core from '@actions/core'
import {cp} from '@actions/io/'
import {exists} from '@actions/io/lib/io-util'
import {getArch} from './utils'

export const STATE_CACHE_KEY = 'cache-key'
export const STATE_CACHE_MATCHED_KEY = 'cache-matched-key'
export const workingDirInput = core.getInput('working-directory')
export const workingDir = workingDirInput ? `/${workingDirInput}` : ''
export const venvPath = `${process.env['GITHUB_WORKSPACE']}${workingDir}/.venv`
export const ryeHomePath = `${process.env['GITHUB_WORKSPACE']}${workingDir}/.rye`
const CACHE_VERSION = '2'
const cacheLocalStoragePath =
  `${core.getInput('cache-local-storage-path')}` || ''
const cacheDependencyPath = `${process.env['GITHUB_WORKSPACE']}${workingDir}/requirements**.lock`

export async function restoreCache(
  cachePrefix: string,
  version: string
): Promise<void> {
  const cacheKey = await computeKeys(cachePrefix, version)
  if (cacheKey.endsWith('-')) {
    throw new Error(
      `No file in ${process.cwd()} matched to [${cacheDependencyPath}], make sure you have checked out the target repository`
    )
  }

  let matchedKey: string | undefined
  try {
    matchedKey = cacheLocalStoragePath
      ? await restoreCacheLocal(cacheKey)
      : await cache.restoreCache([venvPath, ryeHomePath], cacheKey)
  } catch (err) {
    const message = (err as Error).message
    core.warning(message)
    core.setOutput('cache-hit', false)
    return
  }

  core.saveState(STATE_CACHE_KEY, cacheKey)

  handleMatchResult(matchedKey, cacheKey)
}

async function computeKeys(
  cachePrefix: string,
  version: string
): Promise<string> {
  const cacheDependencyPathHash = await glob.hashFiles(cacheDependencyPath)
  const workingDirHash = workingDir
    ? `-${crypto.createHash('sha256').update(workingDir).digest('hex')}`
    : ''
  const prefix = cachePrefix ? `${cachePrefix}-` : ''
  return `${prefix}setup-rye-${CACHE_VERSION}-${process.env['RUNNER_OS']}-${getArch()}-rye-${version}${workingDirHash}-${cacheDependencyPathHash}`
}

function handleMatchResult(
  matchedKey: string | undefined,
  primaryKey: string
): void {
  if (matchedKey) {
    core.saveState(STATE_CACHE_MATCHED_KEY, matchedKey)
    core.info(`Cache restored from key: ${matchedKey}`)
  } else {
    core.info(`No cache found for key: ${primaryKey}`)
  }
  core.setOutput('cache-hit', matchedKey === primaryKey)
}

async function restoreCacheLocal(
  primaryKey: string
): Promise<string | undefined> {
  const storedCache = `${cacheLocalStoragePath}/${primaryKey}`
  if (!(await exists(storedCache))) {
    core.info(`Local cache is not found: ${storedCache}`)
    return
  }
  await cp(`${storedCache}/.venv`, venvPath, {
    recursive: true
  })
  await cp(`${storedCache}/.rye`, ryeHomePath, {
    recursive: true
  })
  return primaryKey
}
