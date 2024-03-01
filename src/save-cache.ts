import * as cache from '@actions/cache'
import * as core from '@actions/core'
import {mkdirP, cp} from '@actions/io/'
import {
  STATE_CACHE_MATCHED_KEY,
  STATE_CACHE_KEY,
  venvPath,
  ryeHomePath
} from './restore-cache'

const enableCache = core.getInput('enable-cache') === 'true'
const cacheLocalStoragePath =
  `${core.getInput('cache-local-storage-path')}` || ''

export async function run(): Promise<void> {
  try {
    if (enableCache) {
      await saveCache()
    }
  } catch (error) {
    const err = error as Error
    core.setFailed(err.message)
  }
}

async function saveCache(): Promise<void> {
  const cacheKey = core.getState(STATE_CACHE_KEY)
  const matchedKey = core.getState(STATE_CACHE_MATCHED_KEY)

  if (!cacheKey) {
    core.warning('Error retrieving key from state.')
    return
  } else if (matchedKey === cacheKey) {
    // no change in target directories
    core.info(`Cache hit occurred on key ${cacheKey}, not saving cache.`)
    return
  }
  core.info(`Saving .venv path: ${venvPath}`)
  core.info(`Saving .rye path: ${ryeHomePath}`)
  cacheLocalStoragePath
    ? await saveCacheLocal(cacheKey)
    : await cache.saveCache([venvPath, ryeHomePath], cacheKey)

  core.info(`Cache saved with the key: ${cacheKey}`)
}

async function saveCacheLocal(cacheKey: string): Promise<void> {
  const targetPath = `${cacheLocalStoragePath}/${cacheKey}`
  await mkdirP(targetPath)
  await cp(venvPath, `${targetPath}/.venv`, {
    recursive: true
  })
  await cp(ryeHomePath, `${targetPath}/.rye`, {
    recursive: true
  })
}

run()
