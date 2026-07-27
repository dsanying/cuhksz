#!/usr/bin/env node

/**
 * Read-only Lanzou Classic crawler.
 *
 * It reads the owner's folder tree and produces the raw manifest consumed by
 * generate-manifest.mjs. It never uploads, deletes or changes Lanzou files.
 */
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import { execFileSync } from "node:child_process"

const root = resolve(import.meta.dirname, "../..")
const args = process.argv.slice(2)
const outputFlag = args.indexOf("--output")
const outputPath = resolve(root, outputFlag >= 0 ? args[outputFlag + 1] : "source/course-resources/lanzou-manifest.json")
const rootFolderId = process.env.LANZOU_CLASSIC_ROOT_FOLDER_ID || "13698202"
const apiOrigin = "https://up.woozooo.com"
const requestDelay = Number(process.env.LANZOU_CLASSIC_REQUEST_DELAY || 260)
const previousSourcePath = resolve(root, process.env.COURSE_RESOURCE_PREVIOUS_SOURCE_PATH || "source/course-resources/lanzou-manifest.json")
const previousLinks = new Map((() => {
  try {
    const previous = JSON.parse(readFileSync(previousSourcePath, "utf8"))
    return (previous.files || []).map((file) => [String(file.path || "").replaceAll("\\", "/"), file.lanzouUrl || file.downloadUrl || ""])
  } catch {
    return []
  }
})().filter(([, url]) => url))

function firefoxCookieHeader() {
  const profilesRoot = resolve(process.env.HOME || "", "Library/Application Support/Firefox/Profiles")
  if (!existsSync(profilesRoot)) return ""
  const profiles = readdirSync(profilesRoot)
    .map((profile) => ({ profile, cookieDb: resolve(profilesRoot, profile, "cookies.sqlite") }))
    .filter(({ cookieDb }) => existsSync(cookieDb))
    .sort((a, b) => statSync(b.cookieDb).mtimeMs - statSync(a.cookieDb).mtimeMs)
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
        return [".woozooo.com", "up.woozooo.com"].includes(host) ? [`${name}=${value.join("|")}`] : []
      })
      if (cookies.length) return cookies.join("; ")
    } catch {
      // Try the next Firefox profile.
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true })
    }
  }
  return ""
}

const cookie = process.env.LANZOU_CLASSIC_COOKIE || firefoxCookieHeader()
if (!cookie) throw new Error("未找到蓝奏云登录态。请设置 LANZOU_CLASSIC_COOKIE，或先在 Firefox 登录蓝奏云网页版。")

const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds))
async function request(url, options = {}, retries = 3) {
  let lastError
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { Cookie: cookie, Referer: `${apiOrigin}/mydisk.php`, "User-Agent": "Mozilla/5.0", ...(options.headers || {}) },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.text()
    } catch (error) {
      lastError = error
      await sleep((attempt + 1) * 600)
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
  const html = await request(`${apiOrigin}/mydisk.php`)
  const uid = html.match(/doupload\.php\?uid=(\d+)/)?.[1] || html.match(/[?&]u=(\d+)/)?.[1] || process.env.LANZOU_CLASSIC_UID
  const vei = html.match(/'vei'\s*:\s*'([^']+)'/)?.[1] || html.match(/"vei"\s*:\s*"([^"]+)"/)?.[1] || process.env.LANZOU_CLASSIC_VEI || "221113"
  if (!uid) throw new Error("蓝奏云登录态已失效，无法识别用户 ID。")
  return { uid, vei }
}

async function listFolders(folderId, session) {
  const response = await postTask({ task: "47", folder_id: String(folderId || -1), vei: session.vei }, session.uid)
  return response?.zt === 1 || response?.zt === 2 ? response.text || [] : []
}

async function listFiles(folderId, session) {
  const files = []
  for (let page = 1; ; page += 1) {
    const response = await postTask({ task: "5", folder_id: String(folderId), pg: String(page), vei: session.vei }, session.uid)
    if (response?.zt !== 1) break
    files.push(...(response.text || []))
    if (String(response.info) === "0") break
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
  return parsed && !Number.isNaN(parsed.valueOf()) ? parsed.toISOString() : new Date().toISOString()
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

async function crawlFolder(folderId, pathSegments) {
  const [folderEntries, fileEntries] = await Promise.all([listFolders(folderId, session), listFiles(folderId, session)])
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
const filesByCourse = await concurrentMap(rootFolders, 1, async (entry) => {
  const course = entryName(entry)
  const courseFolderId = folderId(entry)
  if (!courseFolderId) return []
  const files = await crawlFolder(courseFolderId, [course])
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
  files: filesByCourse.flat(),
  courseFolders,
  failures,
}

writeFileSync(outputPath, `${JSON.stringify(manifest)}\n`)
console.log(`已读取 ${courseFolders.length} 个非空课程文件夹、${manifest.files.length} 个文件；${failures.length} 项未收录。`)
