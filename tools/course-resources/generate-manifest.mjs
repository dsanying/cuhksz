import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, extname, resolve } from "node:path"

const root = resolve(import.meta.dirname, "../..")
const sourcePath = resolve(root, "source/course-resources/lanzou-manifest.json")
const outputPath = resolve(root, "source/course-resources/manifest.json")

const categoryDefinitions = [
  ["learning", "学习资料", "学习资料"],
  ["exam", "考试资料", "考试资料"],
  ["homework", "作业习题", "作业习题"],
  ["other", "其他资料", "其他资料"],
]

function classify(path) {
  const lower = path.toLowerCase()
  if (/考试资料|期中|期末|真题|quiz|midterm|final|exam/.test(lower)) return categoryDefinitions[1]
  if (/作业习题|作业|习题|homework|assignment/.test(lower)) return categoryDefinitions[2]
  if (/学习资料|教材|课件|讲义|笔记|textbook|lecture|slide/.test(lower)) return categoryDefinitions[0]
  return categoryDefinitions[3]
}

const source = JSON.parse(readFileSync(sourcePath, "utf8"))
const byCourse = new Map()

for (const entry of source.files || []) {
  const path = String(entry.path || "").replaceAll("\\", "/")
  const [course, ...rest] = path.split("/")
  if (!course || !rest.length) continue
  const [category, categoryLabel] = classify(path)
  const name = entry.name || rest.at(-1)
  const files = byCourse.get(course) || []
  files.push({
    id: path,
    name,
    path,
    parentPath: rest.slice(0, -1).join("/"),
    category,
    categoryLabel,
    extension: extname(name).slice(1).toLowerCase() || "file",
    size: Number(entry.size || 0),
    updatedAt: entry.updatedAt || source.generatedAt,
    downloadUrl: entry.downloadUrl || entry.lanzouUrl || "",
  })
  byCourse.set(course, files)
}

const folders = new Map((source.courseFolders || []).map((item) => [item.course, item]))
const courses = [...byCourse.entries()]
  .map(([name, files]) => {
    files.sort((a, b) => a.path.localeCompare(b.path, "zh-Hans-CN"))
    return {
      name,
      fileCount: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      latestUpdate: files.reduce((latest, file) => latest > file.updatedAt ? latest : file.updatedAt, ""),
      folderUrl: folders.get(name)?.lanzouUrl || "",
      folderPassword: folders.get(name)?.password || "",
      files,
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"))

const categoryCounts = Object.fromEntries(categoryDefinitions.map(([key]) => [key, 0]))
for (const course of courses) for (const file of course.files) categoryCounts[file.category] += 1

const manifest = {
  generatedAt: source.generatedAt || new Date().toISOString(),
  source: "lanzou-classic",
  stats: {
    courseCount: courses.length,
    fileCount: courses.reduce((sum, course) => sum + course.fileCount, 0),
    totalSize: courses.reduce((sum, course) => sum + course.totalSize, 0),
    categories: categoryDefinitions.map(([key, label]) => ({ key, label, count: categoryCounts[key] })),
  },
  courses,
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(manifest)}\n`)
console.log(`课程资源索引已生成：${manifest.stats.courseCount} 门课程，${manifest.stats.fileCount} 个文件。`)
