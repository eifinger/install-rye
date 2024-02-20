import * as fs from 'fs'
import * as crypto from 'crypto'
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import {KNOWN_CHECKSUMS} from './checksums'

export const IS_WINDOWS = process.platform === 'win32'
export const IS_LINUX = process.platform === 'linux'
export const IS_MAC = process.platform === 'darwin'
export const WINDOWS_ARCHS = ['x86', 'x64']
export const WINDOWS_PLATFORMS = ['win32', 'win64']

export const REPO = 'rye'
export const OWNER = 'mitsuhiko'

export const EARLIEST_VERSION_WITH_NO_MODIFY_PATHSUPPORT = '0.25.0'
export const VERSIONS_WHICH_MODIFY_PROFILE = [
  '0.21.0',
  '0.22.0',
  '0.23.0',
  '0.24.0'
]

export type Architecture = 'x86' | 'x86_64' | 'aarch64'

export enum ComparisonResult {
  Greater = 1,
  Equal = 0,
  Less = -1
}

export function compareVersions(
  versionA: string,
  versionB: string
): ComparisonResult {
  const versionPartsA = versionA.split('.').map(Number)
  const versionPartsB = versionB.split('.').map(Number)

  for (let i = 0; i < versionPartsA.length; i++) {
    if (versionPartsA[i] > versionPartsB[i]) {
      return ComparisonResult.Greater
    } else if (versionPartsA[i] < versionPartsB[i]) {
      return ComparisonResult.Less
    }
  }
  return ComparisonResult.Equal
}

export async function validateCheckSum(
  filePath: string,
  expected: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('error', err => reject(err))
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => {
      const actual = hash.digest('hex')
      resolve(actual === expected)
    })
  })
}

export function isknownVersion(version: string): boolean {
  const pattern = new RegExp(`^.*-.*-${version}$`)
  return Object.keys(KNOWN_CHECKSUMS).some(key => pattern.test(key))
}

export function getArch(): Architecture | undefined {
  const arch = process.arch
  const archMapping: {[key: string]: Architecture} = {
    ia32: 'x86',
    x64: 'x86_64',
    arm64: 'aarch64'
  }

  if (arch in archMapping) {
    return archMapping[arch]
  }
}

export async function getMacOSInfo(): Promise<{
  osName: string
  osVersion: string
}> {
  const {stdout} = await exec.getExecOutput('sw_vers', ['-productVersion'], {
    silent: true
  })

  const macOSVersion = stdout.trim()

  return {osName: 'macOS', osVersion: macOSVersion}
}

export async function getLinuxInfo(): Promise<{
  osName: string
  osVersion: string
}> {
  const {stdout} = await exec.getExecOutput('lsb_release', ['-i', '-r', '-s'], {
    silent: true
  })

  const [osName, osVersion] = stdout.trim().split('\n')

  core.debug(`OS Name: ${osName}, Version: ${osVersion}`)

  return {osName, osVersion}
}
