#!/usr/bin/env node

/**
 * 课程资料库的第二阶段规范化：
 * - 将“课程笔记 / 样卷汇总 / 期中样卷 / 期末样卷”等纯分类中间目录展平；
 * - 仅对展平后的普通文件作无损的文件名清理；
 * - 解压已确认需要保留相对路径的压缩包，并把原压缩包移入待复核区。
 *
 * 默认 dry-run；只有 --apply 才移动或解压文件。
 */

import { access, mkdir, readdir, readFile, rename, rmdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

const rootIndex = process.argv.indexOf('--root')
const root = path.resolve(rootIndex === -1 ? '' : process.argv[rootIndex + 1])
const apply = process.argv.includes('--apply')
if (!root || root === path.parse(root).root) throw new Error('请通过 --root 指定课程资料库目录。')

const reviewRoot = `${root}_待复核_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`
const categories = ['学习资料', '考试资料', '作业习题', '其他资料']
const flattenableNames = new Set(['课程笔记', '样卷汇总', '期中样卷', '期末样卷'])

// 已逐一核对的括号数字/年份名称。括号并不一律代表重复：这里将年份、分卷或资料序号写成明确字段。
const explicitFileRenames = [
  ['MAT1002/考试资料/MAT1002_Midterm_(2024).pdf', 'MAT1002/考试资料/MAT1002_2024_期中样卷.pdf'],
  ['MAT1001/考试资料/MAT1001_Midterm_(2023).pdf', 'MAT1001/考试资料/MAT1001_2023_期中样卷.pdf'],
  ['MAT1001/学习资料/MAT1001_第1&2讲_笔记_函数极限_连续性_单侧极限_特殊极限(1).pdf', 'MAT1001/学习资料/MAT1001_第01至02讲_笔记_函数极限_连续性_单侧极限_特殊极限_第01部分.pdf'],
  ['DDA2001/学习资料/DDA2001_第22-23讲_笔记_Machine_Learning_Introduction_Supervised_Learning_Methods_(1).pdf', 'DDA2001/学习资料/DDA2001_第22至23讲_笔记_Machine_Learning_Introduction_Supervised_Learning_Methods_第01部分.pdf'],
  ['MAT3007/学习资料/MAT3007_小抄_(1).pdf', 'MAT3007/学习资料/MAT3007_小抄_01.pdf'],
  ['MAT3007/学习资料/MAT3007_小抄_(2).pdf', 'MAT3007/学习资料/MAT3007_小抄_02.pdf'],
  ['STA3002/学习资料/STA3002_小抄_(1).pdf', 'STA3002/学习资料/STA3002_小抄_01.pdf'],
  ['STA3002/学习资料/STA3002_小抄_(2).pdf', 'STA3002/学习资料/STA3002_小抄_02.pdf'],
  ['STA2004/学习资料/STA2004_小抄(1).pdf', 'STA2004/学习资料/STA2004_小抄_01.pdf'],
  ['STA2004/学习资料/STA2004_小抄(2).pdf', 'STA2004/学习资料/STA2004_小抄_02.pdf'],
  ['DDA3005/学习资料/DDA3005_小抄_(1).pdf', 'DDA3005/学习资料/DDA3005_小抄_01.pdf'],
  ['DDA3005/学习资料/DDA3005_小抄_(2).pdf', 'DDA3005/学习资料/DDA3005_小抄_02.pdf'],
  ['CSC3001/考试资料/CSC3001_Final(1).pdf', 'CSC3001/考试资料/CSC3001_期末样卷_版本01.pdf'],
  ['PHY1001/学习资料/PHY1001_第8讲_笔记_Chapter_10_(1).pdf', 'PHY1001/学习资料/PHY1001_第08讲_笔记_Chapter_10_第01部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第9讲_笔记_Chapter_10_(2).pdf', 'PHY1001/学习资料/PHY1001_第09讲_笔记_Chapter_10_第02部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第10讲_笔记_Chapter_10_(3).pdf', 'PHY1001/学习资料/PHY1001_第10讲_笔记_Chapter_10_第03部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第11讲_笔记_Chapter_11_(1).pdf', 'PHY1001/学习资料/PHY1001_第11讲_笔记_Chapter_11_第01部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第12讲_笔记_Chapter_11_(2).pdf', 'PHY1001/学习资料/PHY1001_第12讲_笔记_Chapter_11_第02部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第13讲_笔记_Chapter_11_(3).pdf', 'PHY1001/学习资料/PHY1001_第13讲_笔记_Chapter_11_第03部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第15讲_笔记_Chapter_13_(1).pdf', 'PHY1001/学习资料/PHY1001_第15讲_笔记_Chapter_13_第01部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第16讲_笔记_Chapter_13_(2).pdf', 'PHY1001/学习资料/PHY1001_第16讲_笔记_Chapter_13_第02部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第18讲_笔记_Chapter_15_(1).pdf', 'PHY1001/学习资料/PHY1001_第18讲_笔记_Chapter_15_第01部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第19讲_笔记_Chapter_15_(2).pdf', 'PHY1001/学习资料/PHY1001_第19讲_笔记_Chapter_15_第02部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第20讲_笔记_Chapter_16_(1).pdf', 'PHY1001/学习资料/PHY1001_第20讲_笔记_Chapter_16_第01部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第21讲_笔记_Chapter_16_(2).pdf', 'PHY1001/学习资料/PHY1001_第21讲_笔记_Chapter_16_第02部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第22讲_笔记_Chapter_16_(3).pdf', 'PHY1001/学习资料/PHY1001_第22讲_笔记_Chapter_16_第03部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第23讲_笔记_Chapter_17_(1).pdf', 'PHY1001/学习资料/PHY1001_第23讲_笔记_Chapter_17_第01部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第24讲_笔记_Chapter_17_(2).pdf', 'PHY1001/学习资料/PHY1001_第24讲_笔记_Chapter_17_第02部分.pdf'],
  ['PHY1001/学习资料/PHY1001_第25讲_笔记_Chapter_17_(3).pdf', 'PHY1001/学习资料/PHY1001_第25讲_笔记_Chapter_17_第03部分.pdf'],
]

// OneNote 分享链接不是真实资料文件。保留为可双击打开的本地 HTML 入口，原 TXT 移至待复核以便追溯。
const linkedNoteStubs = [
  ['GEA2000/学习资料/GEA2000_.txt', 'GEA2000/学习资料/GEA2000_中国近现代历史与文化_在线笔记.html', 'GEA2000 中国近现代历史与文化'],
  ['CSC3100/学习资料/CSC3100_.txt', 'CSC3100/学习资料/CSC3100_数据结构_在线笔记.html', 'CSC3100 数据结构'],
  ['CSC3170/学习资料/CSC3170_.txt', 'CSC3170/学习资料/CSC3170_数据库系统_在线笔记.html', 'CSC3170 数据库系统'],
  ['CSC3002/学习资料/CSC3002_.txt', 'CSC3002/学习资料/CSC3002_C_C++程序设计_在线笔记.html', 'CSC3002 C/C++ 程序设计'],
  ['GEC2207/学习资料/GEC2207_.txt', 'GEC2207/学习资料/GEC2207_世界政治_在线笔记.html', 'GEC2207 世界政治'],
  ['GFH1000/学习资料/GFH1000_.txt', 'GFH1000/学习资料/GFH1000_与人类对话_在线笔记.html', 'GFH1000 与人类对话'],
  ['GFN1000/学习资料/GFN1000_.txt', 'GFN1000/学习资料/GFN1000_与自然对话_在线笔记.html', 'GFN1000 与自然对话'],
]

function unix(relativePath) {
  return relativePath.split(path.sep).join('/')
}

async function exists(target) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function unique(target) {
  if (!(await exists(target))) return target
  const extension = path.extname(target)
  const stem = extension ? target.slice(0, -extension.length) : target
  for (let version = 2; ; version += 1) {
    const candidate = `${stem}_v${version}${extension}`
    if (!(await exists(candidate))) return candidate
  }
}

function courseCodeFromFileName(name) {
  return (name.normalize('NFKC').match(/^([A-Z]{2,5}\d{4}[A-Z]?)(?=[_\s.-]|$)/) || [])[1]
}

function normalizedFileName(code, original) {
  const extension = path.extname(original)
  let stem = path.basename(original, extension).normalize('NFKC').trim()
  if (stem.toLowerCase().endsWith(extension.toLowerCase())) stem = stem.slice(0, -extension.length)
  stem = stem
    .replace(/[：:]/g, '_')
    .replace(/[，,;；]/g, '_')
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\-.]+|[_\-.]+$/g, '')
  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  stem = stem.replace(new RegExp(`^${escapedCode}[_ -]*`, 'i'), `${code}_`)
  const noteForLecture = stem.match(new RegExp(`^${escapedCode}_Notes_for_Lecture_([^_]+)_(.+)$`, 'i'))
  const lectureNote = stem.match(new RegExp(`^${escapedCode}_Lecture_([^_]+)_Notes(?:_(.+))?$`, 'i'))
  if (noteForLecture) stem = `${code}_第${noteForLecture[1]}讲_笔记_${noteForLecture[2]}`
  if (lectureNote) stem = `${code}_第${lectureNote[1]}讲_笔记${lectureNote[2] ? `_${lectureNote[2]}` : ''}`
  stem = stem.replace(new RegExp(`^${escapedCode}_Cheating_Paper`, 'i'), `${code}_小抄`)
  if (!new RegExp(`^${escapedCode}(?:_|$)`, 'i').test(stem)) stem = `${code}_${stem}`
  return `${stem}${extension.toLowerCase()}`
}

async function listFiles(directory) {
  const files = []
  const queue = [directory]
  while (queue.length) {
    const current = queue.pop()
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name)
      if (entry.isDirectory() && !entry.isSymbolicLink()) queue.push(target)
      if (entry.isFile()) files.push(target)
    }
  }
  return files
}

async function flattenGenericFolders() {
  let folders = 0
  let files = 0
  for (const courseEntry of await readdir(root, { withFileTypes: true })) {
    if (!courseEntry.isDirectory() || courseEntry.name === '其他资料') continue
    const code = courseEntry.name
    for (const category of categories) {
      const categoryPath = path.join(root, code, category)
      if (!(await exists(categoryPath))) continue
      for (const child of await readdir(categoryPath, { withFileTypes: true })) {
        if (!child.isDirectory() || !flattenableNames.has(child.name)) continue
        const sourceDirectory = path.join(categoryPath, child.name)
        const sourceFiles = await listFiles(sourceDirectory)
        console.log(`展平  ${unix(path.relative(root, sourceDirectory))}（${sourceFiles.length} 个文件）`)
        folders += 1
        for (const source of sourceFiles) {
          const sourceName = path.basename(source)
          const sourceCode = courseCodeFromFileName(sourceName)
          const targetCode = sourceCode && sourceCode !== code && !code.split('&').includes(sourceCode) ? sourceCode : code
          const targetCategory = path.join(root, targetCode, category)
          const destination = await unique(path.join(targetCategory, normalizedFileName(targetCode, sourceName)))
          console.log(`  ${unix(path.relative(root, source))}  ->  ${unix(path.relative(root, destination))}`)
          if (apply) {
            await mkdir(path.dirname(destination), { recursive: true })
            await rename(source, destination)
          }
          files += 1
        }
        if (apply) await removeEmptyDirectories(sourceDirectory)
      }
    }
  }
  return { folders, files }
}

async function renameExplicitFiles() {
  let renamed = 0
  for (const [relativeSource, relativeDestination] of explicitFileRenames) {
    const source = path.join(root, relativeSource)
    if (!(await exists(source))) continue
    const destination = await unique(path.join(root, relativeDestination))
    console.log(`改名  ${relativeSource}  ->  ${unix(path.relative(root, destination))}`)
    if (apply) {
      await mkdir(path.dirname(destination), { recursive: true })
      await rename(source, destination)
    }
    renamed += 1
  }
  return renamed
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

async function convertLinkedNoteStubs() {
  let converted = 0
  for (const [relativeSource, relativeDestination, title] of linkedNoteStubs) {
    const source = path.join(root, relativeSource)
    if (!(await exists(source))) continue
    const content = await readFile(source, 'utf8')
    const url = content.match(/https:\/\/[^\s]+/)?.[0]
    if (!url || !url.startsWith('https://1drv.ms/o/')) throw new Error(`链接文本格式异常，未转换：${relativeSource}`)
    const destination = await unique(path.join(root, relativeDestination))
    console.log(`链接入口  ${relativeSource}  ->  ${unix(path.relative(root, destination))}`)
    if (apply) {
      const html = `<!doctype html>\n<html lang="zh-CN">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(title)}｜在线笔记</title>\n<body>\n  <h1>${escapeHtml(title)}</h1>\n  <p>此资料由 OneNote 在线分享提供，双击本文件后点击下方链接打开。</p>\n  <p><a href="${escapeHtml(url)}">打开在线笔记</a></p>\n  <p>如链接失效或需要补充本地资料，请联系资料库维护者。</p>\n</body>\n</html>\n`
      await mkdir(path.dirname(destination), { recursive: true })
      await writeFile(destination, html)
      const reviewDestination = await unique(path.join(reviewRoot, '已转换在线链接文本', relativeSource))
      await mkdir(path.dirname(reviewDestination), { recursive: true })
      await rename(source, reviewDestination)
    }
    converted += 1
  }
  return converted
}

async function removeEmptyDirectories(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue
    await removeEmptyDirectories(path.join(directory, entry.name))
  }
  if ((await readdir(directory)).length === 0) await rmdir(directory)
}

function unzip(source, destination, flatten = false) {
  return new Promise((resolve, reject) => {
    const args = ['-qq']
    if (flatten) args.push('-j')
    args.push(source, '-d', destination)
    const child = spawn('unzip', args, { stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`unzip 退出码：${code}`)))
  })
}

async function extractVerifiedArchives() {
  const archives = [
    {
      source: 'ECO3121/学习资料/ECO3121-Tut-Slides/ECO3121 Slides.zip',
      destination: 'ECO3121/学习资料/ECO3121_教程课件源码',
    },
    {
      source: 'CSC1003/学习资料/课程资料/Assignment/Assignment 1/CSC1003 Assignment 1.zip',
      destination: 'CSC1003/作业习题/作业一_模板',
      flatten: true,
    },
    {
      source: 'CSC1003/学习资料/课程资料/Assignment/Assignment 1/SampleIO.zip',
      destination: 'CSC1003/作业习题/作业一_模板',
      flatten: true,
      allowExisting: true,
    },
    {
      source: 'CSC1003/学习资料/课程资料/Assignment/Assignment 2/CSC1003 Assignment 2.zip',
      destination: 'CSC1003/作业习题/作业二_模板',
      flatten: true,
    },
  ]
  let extracted = 0
  for (const item of archives) {
    const source = path.join(root, item.source)
    if (!(await exists(source))) continue
    const destination = path.join(root, item.destination)
    if ((await exists(destination)) && !item.allowExisting) throw new Error(`解压目标已存在，请先人工确认：${item.destination}`)
    console.log(`解压  ${item.source}  ->  ${item.destination}`)
    if (apply) {
      await mkdir(destination, { recursive: true })
      await unzip(source, destination, item.flatten)
      const archiveDestination = await unique(path.join(reviewRoot, '已解压原压缩包', item.source))
      await mkdir(path.dirname(archiveDestination), { recursive: true })
      await rename(source, archiveDestination)
      await removeEmptyDirectories(path.dirname(source))
    }
    extracted += 1
  }
  return extracted
}

const flattened = await flattenGenericFolders()
const explicitRenames = await renameExplicitFiles()
const convertedLinkedNotes = await convertLinkedNoteStubs()
const extractedArchives = await extractVerifiedArchives()
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', flattenedFolders: flattened.folders, normalizedFiles: flattened.files, explicitRenames, convertedLinkedNotes, extractedArchives }, null, 2))
