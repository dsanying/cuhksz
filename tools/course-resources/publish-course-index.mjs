#!/usr/bin/env node

/**
 * Local-only course index release helper.
 *
 * It deliberately stages only the generated index files. Website deployment
 * continues through the repository's existing push-based Pages workflow.
 */
import { execFileSync } from "node:child_process"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "../..")

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit" })
}

function output(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: "utf8" }).trim()
}

run("npm", ["run", "course:sync"])
run("npm", ["run", "build"])

const indexPaths = ["source/course-resources/lanzou-manifest.json", "source/course-resources/manifest.json"]
const changes = output("git", ["status", "--porcelain", "--", ...indexPaths])

if (!changes) {
  console.log("课程索引没有变化；未创建提交或部署。")
  process.exit(0)
}

run("git", ["add", "--", ...indexPaths])
run("git", ["commit", "-m", "chore(course): 同步蓝奏云课程索引"])
run("git", ["push"])
console.log("课程索引已提交并推送；GitHub Pages 将按仓库现有部署流程更新。")
