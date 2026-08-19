#!/usr/bin/env node

/**
 * 审计本地课程资料库；默认不修改资料文件，--quarantine 会将高风险文件移入待复核目录。
 *
 * 用法：
 * node scripts/audit-course-library.mjs \
 *   --root '/Users/name/Downloads/港中深课程资料库' \
 *   --report '/tmp/course-library-audit.json'
 */

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, mkdir, readdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const validCategories = new Set(['学习资料', '考试资料', '作业习题', '其他资料'])
const ignoredNames = new Set(['.DS_Store', 'Thumbs.db'])
const generatedDirectoryNames = new Set(['.git', '__MACOSX', '__pycache__', 'node_modules', 'dist', 'build', 'out', 'target', 'coverage', '.vscode', '.vs', '.idea', '.cmake', 'cmake-build-debug', 'CMakeFiles'])
const generatedExtensions = new Set(['.pyc', '.o', '.obj', '.class', '.log', '.tmp', '.swp', '.swo'])
const privacyPattern = /(?:学生名单|姓名.*学号|学号.*姓名|成绩单|成绩证明|考勤|签到|座位表|联系方式|身份证|student[ _-]?list|attendance|roster)/i
const studentProjectPattern = /(?:submission|submit|personal|个人|学生.*(?:项目|作业|报告)|(?:^|[_-])team[_-]?\d+|final[_ -]?project|coursework)/i
const courseCodePattern = /^[A-Z]{2,5}\d{4}[A-Z]?$/

function readOption(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function relativeUnix(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join('/')
}

function extensionOf(name) {
  const extension = path.extname(name).toLowerCase()
  return extension || '[无扩展名]'
}

function isSystemArtifact(name, relativePath) {
  const parts = relativePath.split('/')
  return ignoredNames.has(name) || name.startsWith('._') || name.startsWith('~$') || name.endsWith('.synctex.gz') || parts.some((part) => generatedDirectoryNames.has(part)) || generatedExtensions.has(extensionOf(name))
}

function isLikelyStudentProject(relativePath) {
  return studentProjectPattern.test(relativePath)
}

async function walk(root, onFile, onDirectory) {
  const queue = [root]
  while (queue.length > 0) {
    const current = queue.pop()
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        await onDirectory(absolutePath, entry.name)
        queue.push(absolutePath)
      } else if (entry.isFile()) {
        await onFile(absolutePath, entry.name)
      }
    }
  }
}

async function sha256(absolutePath) {
  const digest = createHash('sha256')
  await new Promise((resolve, reject) => {
    createReadStream(absolutePath)
      .on('data', (chunk) => digest.update(chunk))
      .on('error', reject)
      .on('end', resolve)
  })
  return digest.digest('hex')
}

function uniqueTopLevelPaths(paths) {
  return [...new Set(paths)].sort((a, b) => a.length - b.length).filter((candidate, index, sorted) =>
    !sorted.slice(0, index).some((parent) => candidate === parent || candidate.startsWith(`${parent}/`)),
  )
}

function highConfidenceProjectPath(relativePath) {
  const parts = relativePath.split('/')
  const directories = parts.slice(0, -1)
  const index = directories.findIndex((part) =>
    /(?:submission|submit|coursework|个人|学生.*(?:项目|作业|报告)|final[_ -]?project|(?:^|[_-])team[_-]?\d+|(?:^|[_-])\d{8,}(?:$|[_-]))/i.test(part),
  )
  return index === -1 ? undefined : directories.slice(0, index + 1).join('/')
}

async function moveIntoReview(root, reviewRoot, relativePath, bucket) {
  const source = path.join(root, relativePath)
  const destination = path.join(reviewRoot, bucket, relativePath)
  try {
    await access(source)
  } catch {
    return false
  }
  await mkdir(path.dirname(destination), { recursive: true })
  await rename(source, destination)
  return true
}

async function main() {
  const root = path.resolve(readOption('--root') || '')
  const reportPath = path.resolve(readOption('--report') || path.join(process.cwd(), 'tmp', 'course-library-audit.json'))
  const hashDuplicates = process.argv.includes('--hash-duplicates')
  const quarantine = process.argv.includes('--quarantine')
  if (!root || root === path.parse(root).root) throw new Error('请通过 --root 指定课程资料库目录。')

  const courseRoots = new Map()
  const extensionCounts = new Map()
  const sizeGroups = new Map()
  const systemArtifacts = []
  const privacyCandidates = []
  const studentProjectCandidates = new Set()
  const highConfidenceStudentProjects = new Set()
  const structuralIssues = []
  const gitRoots = new Set()
  let fileCount = 0
  let totalBytes = 0

  await walk(root, async (absolutePath, name) => {
    const relativePath = relativeUnix(root, absolutePath)
    const parts = relativePath.split('/')
    const rootName = parts[0]
    const info = await stat(absolutePath)
    fileCount += 1
    totalBytes += info.size
    extensionCounts.set(extensionOf(name), (extensionCounts.get(extensionOf(name)) || 0) + 1)
    courseRoots.set(rootName, (courseRoots.get(rootName) || 0) + 1)

    if (isSystemArtifact(name, relativePath)) systemArtifacts.push({ path: relativePath, bytes: info.size })
    if (privacyPattern.test(relativePath)) privacyCandidates.push({ path: relativePath, bytes: info.size })
    if (isLikelyStudentProject(relativePath)) studentProjectCandidates.add(parts.slice(0, Math.min(parts.length - 1, 4)).join('/'))
    const highConfidenceProject = highConfidenceProjectPath(relativePath)
    if (highConfidenceProject) highConfidenceStudentProjects.add(highConfidenceProject)

    if (parts.length > 1 && rootName !== '其他资料' && rootName !== '_待复核' && rootName !== '_待确认删除' && !validCategories.has(parts[1])) {
      structuralIssues.push({ path: relativePath, issue: '课程一级目录下未使用标准资料分类' })
    }

    if (hashDuplicates && !isSystemArtifact(name, relativePath)) {
      const key = String(info.size)
      const paths = sizeGroups.get(key) || []
      paths.push(absolutePath)
      sizeGroups.set(key, paths)
    }
  }, async (absolutePath, name) => {
    const relativePath = relativeUnix(root, absolutePath)
    if (name === '.git') gitRoots.add(relativeUnix(root, path.dirname(absolutePath)))
  })

  const duplicateGroups = []
  if (hashDuplicates) {
    for (const candidates of sizeGroups.values()) {
      if (candidates.length < 2) continue
      const byHash = new Map()
      for (const candidate of candidates) {
        const hash = await sha256(candidate)
        const sameFiles = byHash.get(hash) || []
        sameFiles.push(relativeUnix(root, candidate))
        byHash.set(hash, sameFiles)
      }
      for (const [hash, files] of byHash) {
        if (files.length > 1) duplicateGroups.push({ sha256: hash, files })
      }
    }
  }

  const roots = [...courseRoots.entries()].map(([name, files]) => ({
    name,
    files,
    courseCodeLike: courseCodePattern.test(name),
    inSiteManifest: false,
  })).sort((a, b) => b.files - a.files)

  const report = {
    generatedAt: new Date().toISOString(),
    root,
    summary: {
      files: fileCount,
      bytes: totalBytes,
      systemArtifacts: systemArtifacts.length,
      privacyCandidates: privacyCandidates.length,
      gitRepositories: gitRoots.size,
      structuralIssues: structuralIssues.length,
      duplicateGroups: duplicateGroups.length,
    },
    roots,
    extensionCounts: Object.fromEntries([...extensionCounts.entries()].sort((a, b) => b[1] - a[1])),
    systemArtifacts,
    privacyCandidates,
    gitRepositories: [...gitRoots].sort(),
    likelyStudentProjectPaths: [...studentProjectCandidates].sort(),
    highConfidenceStudentProjects: uniqueTopLevelPaths([...highConfidenceStudentProjects]),
    structuralIssues: structuralIssues.slice(0, 10000),
    duplicateGroups,
  }

  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report.summary, null, 2))
  console.log(`审计报告：${reportPath}`)

  if (quarantine) {
    const reviewRoot = `${root}_待复核_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`
    let movedProjects = 0
    let movedPrivacy = 0
    let movedArtifacts = 0
    for (const relativePath of report.highConfidenceStudentProjects) {
      if (await moveIntoReview(root, reviewRoot, relativePath, '疑似学生项目')) movedProjects += 1
    }
    for (const candidate of report.privacyCandidates) {
      if (await moveIntoReview(root, reviewRoot, candidate.path, '隐私风险文件')) movedPrivacy += 1
    }
    for (const artifact of report.systemArtifacts) {
      if (await moveIntoReview(root, reviewRoot, artifact.path, '系统与编译冗余')) movedArtifacts += 1
    }
    console.log(JSON.stringify({ reviewRoot, movedProjects, movedPrivacy, movedArtifacts }, null, 2))
  }
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exitCode = 1
})
