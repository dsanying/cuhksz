#!/usr/bin/env node

/**
 * Read-only Lanzou Classic crawler.
 *
 * It reads the owner's folder tree and produces the raw manifest consumed by
 * generate-manifest.mjs. It never uploads, deletes or changes Lanzou files.
 */
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import { execFileSync } from "node:child_process"

const root = resolve(import.meta.dirname, "../..")
const args = process.argv.slice(2)
const outputFlag = args.indexOf("--output")
const outputPath = resolve(root, outputFlag >= 0 ? args[outputFlag + 1] : "source/course-resources/lanzou-manifest.json")
const rootFolderId = process.env.LANZOU_CLASSIC_ROOT_FOLDER_ID || "13698202"
const apiOrigin = "https://up.woozooo.com"
const requestDelay = Number(process.env.LANZOU_CLASSIC_REQUEST_DELAY || 100)
const requestTimeout = Number(process.env.LANZOU_CLASSIC_REQUEST_TIMEOUT || 15000)
const rootConcurrency = Math.max(1, Math.min(3, Number(process.env.LANZOU_CLASSIC_ROOT_CONCURRENCY || 3)))
const previousSourcePath = resolve(root, process.env.COURSE_RESOURCE_PREVIOUS_SOURCE_PATH || "source/course-resources/lanzou-manifest.json")
const previousLinks = new Map((() => {
  try {
    const previous = JSON.parse(readFileSync(previousSourcePath, "utf8"))
    return (previous.files || []).map((file) => [String(file.path || "").replaceAll("\\", "/"), file.lanzouUrl || file.downloadUrl || ""])
  } catch {
    return []
  }
})().filter(([, url]) => url))
const previousSource = (() => {
  try {
    return JSON.parse(readFileSync(previousSourcePath, "utf8"))
  } catch {
    return null
  }
})()

function firefoxCookieHeaders() {
  const profilesRoot = resolve(process.env.HOME || "", "Library/Application Support/Firefox/Profiles")
  if (!existsSync(profilesRoot)) return []
  const profiles = readdirSync(profilesRoot)
    .map((profile) => ({ profile, cookieDb: resolve(profilesRoot, profile, "cookies.sqlite") }))
    .filter(({ cookieDb }) => existsSync(cookieDb))
    .sort((a, b) => statSync(b.cookieDb).mtimeMs - statSync(a.cookieDb).mtimeMs)
  const headers = []
  for (const { cookieDb } of profiles) {
    const temporaryDirectory = mkdtempSync(resolve(tmpdir(), "lanzou-cookie-"))
    const temporaryDb = resolve(temporaryDirectory, "cookies.sqlite")
    try {
      copyFileSync(cookieDb, temporaryDb)
      for (const suffix of ["-wal", "-shm"]) {
        const sidecar = `${cookieDb}${suffix}`
        if (existsSync(sidecar)) copyFileSync(sidecar, `${temporaryDb}${suffix}`)
      }
      const raw = execFileSync("sqlite3", [temporaryDb, "SELECT host || '|' || name || '|' || value FROM moz_cookies WHERE host LIKE '%woozooo%' ORDER BY host, name"], { encoding: "utf8" })
      const cookies = raw.trim().split("\n").filter(Boolean).flatMap((row) => {
        const [host, name, ...value] = row.split("|")
        // 蓝奏云登录会在 up、accounts 等子域写入 Cookie；请求脚本自行
        // 发送 Cookie 头，因此需要保留同一主域的完整登录态。
        return host.endsWith("woozooo.com") ? [`${name}=${value.join("|")}`] : []
      })
      if (cookies.length) headers.push(cookies.join("; "))
    } catch {
      // Try the next Firefox profile.
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true })
    }
  }
  return [...new Set(headers)]
}

const firefoxCookies = firefoxCookieHeaders()
let cookie = process.env.LANZOU_CLASSIC_COOKIE || firefoxCookies[0] || ""
if (!cookie) throw new Error("未找到蓝奏云登录态。请设置 LANZOU_CLASSIC_COOKIE，或先在 Firefox 登录蓝奏云网页版。")

const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds))
async function request(url, options = {}, retries = 3) {
  let lastError
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), requestTimeout)
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: { Cookie: cookie, Referer: `${apiOrigin}/mydisk.php`, "User-Agent": "Mozilla/5.0", ...(options.headers || {}) },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.text()
    } catch (error) {
      lastError = error
      await sleep((attempt + 1) * 600)
    } finally {
      clearTimeout(timeout)
    }
  }
  throw lastError
}

async function postTask(payload, uid = "") {
  await sleep(requestDelay)
  const text = await request(`${apiOrigin}/doupload.php${uid ? `?uid=${encodeURIComponent(uid)}` : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" },
    body: new URLSearchParams(payload),
  })
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`蓝奏云返回非 JSON：${text.slice(0, 100)}`)
  }
}

async function sessionInfo() {
  const candidates = [...new Set([cookie, ...firefoxCookies].filter(Boolean))]
  for (const candidate of candidates) {
    cookie = candidate
    const html = await request(`${apiOrigin}/mydisk.php`)
    const uid = html.match(/doupload\.php\?uid=(\d+)/)?.[1] || html.match(/[?&]u=(\d+)/)?.[1] || process.env.LANZOU_CLASSIC_UID
    const vei = html.match(/'vei'\s*:\s*'([^']+)'/)?.[1] || html.match(/"vei"\s*:\s*"([^"]+)"/)?.[1] || process.env.LANZOU_CLASSIC_VEI || "221113"
    if (uid) return { uid, vei }
  }
  throw new Error("蓝奏云登录态已失效，无法识别用户 ID。请先在 Firefox 登录蓝奏云后台后重试。")
}

async function listFolders(folderId, session) {
  const response = await postTask({ task: "47", folder_id: String(folderId || -1), vei: session.vei }, session.uid)
  return response?.zt === 1 || response?.zt === 2 ? response.text || [] : []
}

async function listFiles(folderId, session) {
  const files = []
  const seenFileIds = new Set()
  for (let page = 1; ; page += 1) {
    const response = await postTask({ task: "5", folder_id: String(folderId), pg: String(page), vei: session.vei }, session.uid)
    if (response?.zt !== 1) break
    const pageFiles = response.text || []
    const newFiles = pageFiles.filter((entry) => {
      const id = fileId(entry)
      if (!id || seenFileIds.has(id)) return false
      seenFileIds.add(id)
      return true
    })
    files.push(...newFiles)
    if (String(response.info) === "0" || !pageFiles.length || !newFiles.length) break
  }
  return files
}

async function fileShare(fileId) {
  const response = await postTask({ task: "22", file_id: String(fileId) })
  return response?.zt === 1 ? response.info : {}
}

async function folderShare(folderId) {
  const response = await postTask({ task: "18", folder_id: String(folderId) })
  return response?.zt === 1 ? response.info : {}
}

function first(record, keys) {
  return keys.map((key) => record?.[key]).find((value) => value !== undefined && value !== null && value !== "")
}

function entryName(entry) {
  return String(first(entry, ["name_all", "name", "folder_name", "fol_name", "filename"]) || "未命名")
}

function fileId(entry) {
  return String(first(entry, ["id", "f_id", "file_id"]) || "")
}

function folderId(entry) {
  return String(first(entry, ["fol_id", "folder_id", "id"]) || "")
}

function parseSize(value) {
  if (typeof value === "number") return value
  const text = String(value || "").trim()
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text)
  const match = text.match(/([\d.]+)\s*([KMGTP]?B?)/i)
  if (!match) return 0
  const unit = match[2].toUpperCase().replace("B", "")
  const multiplier = { "": 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5 }[unit] || 1
  return Number(match[1]) * multiplier
}

function entryDate(entry) {
  const raw = first(entry, ["time", "upload_time", "updated_at", "ctime"])
  const parsed = raw ? new Date(raw) : null
  return parsed && !Number.isNaN(parsed.valueOf()) ? parsed.toISOString() : ""
}

function directUrl(entry, share) {
  const token = first(share, ["is_newd", "f_id", "url", "new_url"]) || first(entry, ["is_newd", "f_id", "url", "new_url"])
  if (!token) return ""
  const text = String(token)
  if (/^https?:\/\//.test(text)) return text
  return `https://dsanying.lanzoue.com/${text}`
}

async function concurrentMap(items, limit, mapper) {
  const result = []
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++
      result[index] = await mapper(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return result
}

const session = await sessionInfo()
const failures = []

if (args.includes("--inspect")) {
  const folders = await listFolders(rootFolderId, session)
  const sampleFolder = folders[0]
  const files = sampleFolder ? await listFiles(folderId(sampleFolder), session) : []
  console.log(JSON.stringify({
    rootFolderCount: folders.length,
    folderFields: Object.keys(sampleFolder || {}).sort(),
    fileFields: Object.keys(files[0] || {}).sort(),
  }, null, 2))
  process.exit(0)
}

if (args.includes("--list-folders")) {
  const collectFolderPaths = async (parentId, path = []) => {
    const children = await listFolders(parentId, session)
    const results = []
    for (const child of children) {
      const name = entryName(child)
      const nextPath = [...path, name]
      results.push(nextPath.join("/"))
      results.push(...await collectFolderPaths(folderId(child), nextPath))
    }
    return results
  }
  console.log(JSON.stringify(await collectFolderPaths(rootFolderId), null, 2))
  process.exit(0)
}

async function crawlFolder(currentFolderId, pathSegments) {
  const [folderEntries, fileEntries] = await Promise.all([listFolders(currentFolderId, session), listFiles(currentFolderId, session)])
  const fileRecords = await concurrentMap(fileEntries, 3, async (entry) => {
    const id = fileId(entry)
    try {
      const name = entryName(entry)
      const path = [...pathSegments, name].join("/")
      // Existing file shares are stable. Reusing them prevents one API request
      // per unchanged file and keeps the scheduled read within Lanzou's limits.
      const url = previousLinks.get(path) || directUrl(entry, id ? await fileShare(id) : {})
      if (!url) throw new Error("缺少文件分享链接")
      return {
        path,
        name,
        size: parseSize(first(entry, ["size", "size_num", "filesize"])),
        updatedAt: entryDate(entry),
        lanzouUrl: url,
      }
    } catch (error) {
      failures.push({ path: [...pathSegments, entryName(entry)].join("/"), reason: error.message })
      return null
    }
  })
  const children = await concurrentMap(folderEntries, 2, async (entry) => {
    const childId = folderId(entry)
    if (!childId) return []
    try {
      return await crawlFolder(childId, [...pathSegments, entryName(entry)])
    } catch (error) {
      failures.push({ path: [...pathSegments, entryName(entry)].join("/"), reason: error.message })
      return []
    }
  })
  return [...fileRecords.filter(Boolean), ...children.flat()]
}

const rootFolders = await listFolders(rootFolderId, session)
const courseFolders = []
console.log(`开始扫描蓝奏云根目录：${rootFolders.length} 个一级目录，并发 ${rootConcurrency}。`)
let scannedRootFolderCount = 0
const filesByCourse = await concurrentMap(rootFolders, rootConcurrency, async (entry) => {
  const course = entryName(entry)
  const courseFolderId = folderId(entry)
  if (!courseFolderId) return []
  const files = await crawlFolder(courseFolderId, [course])
  scannedRootFolderCount += 1
  console.log(`[${scannedRootFolderCount}/${rootFolders.length}] ${course}：${files.length} 个文件`)
  if (!files.length) return []
  try {
    const share = await folderShare(courseFolderId)
    const url = directUrl({}, share)
    if (url) courseFolders.push({ course, folderId: courseFolderId, lanzouUrl: url, password: first(share, ["pwd", "password", "pass"]) || "", verified: true })
  } catch (error) {
    failures.push({ path: course, reason: `课程文件夹分享读取失败：${error.message}` })
  }
  return files
})

const manifest = {
  generatedAt: new Date().toISOString(),
  source: "lanzou-classic-readonly",
  rootFolderId,
  files: filesByCourse.flat().sort((a, b) => a.path.localeCompare(b.path, "zh-Hans-CN")),
  courseFolders: courseFolders.sort((a, b) => `${a.course}/${a.folderId}`.localeCompare(`${b.course}/${b.folderId}`, "zh-Hans-CN")),
  failures: failures.sort((a, b) => a.path.localeCompare(b.path, "zh-Hans-CN")),
}

if (previousSource) {
  const previousComparable = { ...previousSource, generatedAt: "" }
  const currentComparable = { ...manifest, generatedAt: "" }
  if (JSON.stringify(previousComparable) === JSON.stringify(currentComparable)) {
    manifest.generatedAt = previousSource.generatedAt
    console.log("蓝奏云目录没有实质变化，保留现有索引时间戳。")
  }
}

writeFileSync(outputPath, `${JSON.stringify(manifest)}\n`)
console.log(`已读取 ${courseFolders.length} 个非空课程文件夹、${manifest.files.length} 个文件；${failures.length} 项未收录。`)
