#!/usr/bin/env node

/**
 * 将已人工确认的“课程笔记”和“样卷”归入标准课程目录，
 * 并隔离明确属于学生项目的目录。默认只打印计划；传入 --apply 才移动文件。
 */

import { access, mkdir, readdir, rename, rmdir } from 'node:fs/promises'
import path from 'node:path'

const rootOption = process.argv.indexOf('--root')
const root = path.resolve(rootOption === -1 ? '' : process.argv[rootOption + 1])
const apply = process.argv.includes('--apply')
if (!root || root === path.parse(root).root) throw new Error('请通过 --root 指定课程资料库目录。')

const reviewRoot = `${root}_待复核_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`
const noteSource = '其他资料/学习资料/CUHK-Shenzhen-Notes'
const examSource = '其他资料/考试资料/CUHKSZ_SDS_EXAMS'

// 已通过目录 README 和文件结构确认的学生作品或个人项目；仅隔离，不永久删除。
const confirmedStudentProjects = [
  'ERG2050/学习资料/IMDB-sentiment-analysis',
  'CSC4005/学习资料/CSC4005-Distributed-System',
  'CSC4005/学习资料/CSC4005-HW',
  'CSC4005/学习资料/Parallel-Programming',
  'CSC4001/学习资料/CSC4001-Better-SIS',
  'CSC4001/学习资料/CSC4001_Project',
  'CSC4001/学习资料/SE-CloudLGU',
  'CSC4001/学习资料/csc4001-22spring',
  'CIE6016/学习资料/CIE6016',
  'CSC1001/学习资料/CSC1001_Project_DecisionTree',
  'CSC1001/学习资料/CUHKSZ-CSC1001',
  'CSC1002/学习资料/CUHK-SZ-CSC1002',
  'CSC1002/学习资料/Snake-CSC1002-of-CUHKSZ',
  'CSC1002/学习资料/Snake-Game-project-in-CSC1002',
  'CSC3002/学习资料/CSC3002_23Fall_Assignments',
  'CSC3002/学习资料/MusicMonster',
  'CSC3050/学习资料/CSC3050-2025-Spring-Project-3',
  'CSC3050/学习资料/CSC3050-EdgarFei',
  'CSC3050/学习资料/CSC3050-Computer-Architecture',
  'CSC3050/学习资料/MIPS-Assembler',
  'CSC3060/学习资料/CSC3060_Project4',
  'CSC3060/学习资料/CSC3060_Project5',
  'CSC3170/学习资料/CSC3170-Project',
  'CSC3170/学习资料/EduSpark',
  'CSC3170/学习资料/gba-hotel',
  'CSC4120/学习资料/CSC4120_Final_Project',
  'CSC4120/学习资料/算法设计与分析复习笔记/project',
  'DDA3005/学习资料/Image-Deblurring-and-QR-Factorizations',
  'DDA4080/学习资料/DDA4080-Industry-Project-Tencent-x-CUHK-Shenzhen-',
  'DDA4210/学习资料/AI-Image-Detection',
  'DDA5001/学习资料/MathTune-Qwen',
  'ECE3080/学习资料/ECE3080-PROJECT-CUHKSZ',
  'ECE4016/学习资料/ECE4016_Computer-Network_a1',
  'ECE3200/学习资料/Project-Backrooms',
  'ECE4310/学习资料/-ECE4310-Service-Robot-',
  'FIN3080/学习资料/CUHKSZ-FIN3080',
  'IBA6002/学习资料/ExamSystem',
  'IBA6104/学习资料/UsedCarPricing',
  'IUYE1212/学习资料/Fake-OS-CUHK-Shenzhen',
  'MAT3007/学习资料/MAT3007',
  'MDS6002/学习资料/StableSVC',
  'MFE5130/学习资料/Project_MFE5130_2025Fall',
  'CSC1006/学习资料/CUHK-SZ-CSC1006',
  'CSC3100/学习资料/CUHKSZ-CSC3100-EdgarFei',
  'CSC3100/学习资料/CUHKSZ-CSC3100',
  'CSC3150/学习资料/CUHKSZ-CSC3150-EdgarFei',
  'CSC3150/学习资料/CSC3150-Operating-System',
  'CSC3150/学习资料/课程资料',
  'CSC3185/学习资料/CSC3185_CUHKSZ',
  'DDA3020/学习资料/CUHKSZ-DDA3020',
  'DDA3020/学习资料/DDA3020',
  'ECON3211/学习资料/ECON3211_PolicyEvaluationMethods',
  'CSC3001/学习资料/离散数学课程资料',
  '其他资料/学习资料/Computer_Graphics_Projects',
  '其他资料/学习资料/CUHKSZ-3D-2DFaces',
  '其他资料/学习资料/CUHKSZ_DIP',
  '其他资料/学习资料/CUHKSZ_Operating_System',
  '其他资料/学习资料/Heat-Simulation',
  '其他资料/学习资料/Many-Bodies-Simulation',
  '其他资料/学习资料/Mandelbrot-Set-Computation',
  '其他资料/学习资料/Menger-CUHKSZ-files',
  '其他资料/学习资料/Odd-Even-Transposition-Sort',
]

// 可由目录名和 README 明确识别课程归属的非项目资料集合。
const courseCollectionMoves = [
  ['ALEE1222/学习资料/CSC3001_Discrete_Mathematics', 'CSC3001/学习资料/离散数学课程资料'],
  ['ALEE1222/学习资料/CSC3002_Review_Question_Answer', 'CSC3002/学习资料/复习题参考'],
  ['NTUO666/学习资料/CSC1003', 'CSC1003/学习资料/课程资料'],
  ['NTUO666/学习资料/CSC3150', 'CSC3150/学习资料/课程资料'],
  ['NTUO666/学习资料/CSC3170', 'CSC3170/学习资料/课程资料'],
  ['NTUO666/学习资料/CSC4160', 'CSC4160/学习资料/课程资料'],
  ['LTAN9999/学习资料/CUHKSZ-MDS5102', 'MDS5102/学习资料/课程资料'],
  ['CSC4005/学习资料/CUHKSZ-CSC4005', 'CSC4005/学习资料/课程项目_官方模板'],
  ['DDA3020/学习资料/DDA3020-Exercises-2026-Spring-', 'DDA3020/学习资料/2026_春季_练习题'],
  ['FIN1010S/学习资料/fin1010subs', 'FIN1010S/学习资料/课程视频字幕'],
]

// 已迁移课程集合中的目录名继续中文化；仅用于确需保持内部相对路径的集合。
const nestedCollectionMoves = [
  ['DDA3020/学习资料/2026_春季_练习题/Supervised learning', 'DDA3020/学习资料/2026_春季_练习题/监督学习'],
  ['DDA3020/学习资料/2026_春季_练习题/Unsupervised_Learning', 'DDA3020/学习资料/2026_春季_练习题/无监督学习'],
  ['FIN1010S/学习资料/课程视频字幕/subtitles', 'FIN1010S/学习资料/课程视频字幕/字幕文件'],
  ['CIE6002/学习资料/MatrixAnalysisNotes', 'CIE6002/学习资料/矩阵分析笔记'],
  ['CIE6022/学习资料/DynamicProgrammingNotes', 'CIE6022/学习资料/动态规划笔记'],
  ['CSC1002/学习资料/Python-Learning-Notes', 'CSC1002/学习资料/Python_学习笔记'],
  ['CSC3002/学习资料/StanfordLib-CUHKSZ', 'CSC3002/学习资料/C++_配套库'],
  ['CSC3002/学习资料/cuhksz-qt', 'CSC3002/学习资料/C++_环境配置'],
  ['CSC3060/学习资料/Computer-Architecture-Notes', 'CSC3060/学习资料/计算机体系结构笔记'],
  ['CSC4005/学习资料/CSC4005_2022Fall_Demo', 'CSC4005/学习资料/2022_秋季_项目演示代码'],
  ['CSC4120/学习资料/CSC4120-Design-and-Analysis-of-Algorithms', 'CSC4120/学习资料/算法设计与分析复习笔记'],
  ['CSC4180/学习资料/CSC4180-Compiler', 'CSC4180/学习资料/编译原理课程资料'],
  ['DDA3020/学习资料/machine-learning-notes', 'DDA3020/学习资料/机器学习笔记'],
  ['STA4001/学习资料/STA4001_stochastic_process', 'STA4001/学习资料/随机过程笔记'],
]

const otherItemsToReview = [
  '_待确认删除',
  'README_资料清单.md',
  'AIY2026',
  'AMES817',
  'CORN2017',
  'PAUL891',
  'RTX5090',
  'STTT153',
  'TONG010',
  '其他资料/学习资料/CSC_3150',
  '其他资料/学习资料/CUHKSZ_SMBU',
  '其他资料/学习资料/CUHK-Shenzhen-Notes',
  '其他资料/考试资料/CUHKSZ_SDS_EXAMS',
  '其他资料/学习资料/LGU-Course',
  '其他资料/学习资料/Seminars',
  '其他资料/学习资料/cuhksz-ml-notes',
  '其他资料/学习资料/directed-polymers-shenzhen-2026',
  '其他资料/学习资料/mips-five-stage-cpu',
  '其他资料/作业习题/Introduction-to-Programming',
  '其他资料/其他资料/-IB-AP-A-Level-',
  '其他资料/其他资料/CUHKSZ_sourse',
  '其他资料/其他资料/CUHKSZ-Manual',
  '其他资料/其他资料/CUHKSZLib',
  '其他资料/其他资料/CUHK_SZ_DL',
  '其他资料/其他资料/coursecupid',
  '其他资料/其他资料/phoenix_cuhksz_knowledge',
  'ALEE1222',
  'NTUO666',
  'OUSZ158',
  'IGHT0721',
  'GED2404',
]

// 这些集合混有学生实现、报告或运行产物；先抽出下方可确认的课程发布材料，再整体待复核。
const mixedCourseMaterialsToReview = [
  'CSC1003/学习资料/课程资料',
  'CSC3170/学习资料/课程资料',
  'CSC4160/学习资料/课程资料',
  'MDS5102/学习资料/课程资料',
]

// 从待隔离目录中单独保留的课程发布材料。报告、实现、提交物不在此列表内。
const confirmedOfficialMaterialMoves = [
  ['ALEE1222/学习资料/CSC4005_Distributed_and_Parallel_Computing/Project 1 - Parallel Odd-Even Transposition Sort/Assignment 1 Requirement.pdf', 'CSC4005/作业习题/CSC4005_项目_01_题目.pdf'],
  ['ALEE1222/学习资料/CSC4005_Distributed_and_Parallel_Computing/Project 1 - Parallel Odd-Even Transposition Sort/Assignment 1 Grading.pdf', 'CSC4005/作业习题/CSC4005_项目_01_评分说明.pdf'],
  ['ALEE1222/学习资料/CSC4005_Distributed_and_Parallel_Computing/Project 2 - Mandelbrot Set Computation/Assignment 2 Requirement.pdf', 'CSC4005/作业习题/CSC4005_项目_02_题目.pdf'],
  ['ALEE1222/学习资料/CSC4005_Distributed_and_Parallel_Computing/Project 2 - Mandelbrot Set Computation/Assignment 2 Grading.pdf', 'CSC4005/作业习题/CSC4005_项目_02_评分说明.pdf'],
  ['ALEE1222/学习资料/CSC4005_Distributed_and_Parallel_Computing/Project 3 - N-body Simulation/Assignment 3 Requirement.pdf', 'CSC4005/作业习题/CSC4005_项目_03_题目.pdf'],
  ['ALEE1222/学习资料/CSC4005_Distributed_and_Parallel_Computing/Project 3 - N-body Simulation/Assignment 3 Grading.pdf', 'CSC4005/作业习题/CSC4005_项目_03_评分说明.pdf'],
  ['ALEE1222/学习资料/CSC4005_Distributed_and_Parallel_Computing/Project 4 - Heat Simulation/Assignment 4 Requirement.pdf', 'CSC4005/作业习题/CSC4005_项目_04_题目.pdf'],
  ['ALEE1222/学习资料/CSC4005_Distributed_and_Parallel_Computing/Project 4 - Heat Simulation/Assignment 4 Grading.pdf', 'CSC4005/作业习题/CSC4005_项目_04_评分说明.pdf'],
  ['ALEE1222/学习资料/CSC3150_Operating_Systems/Final_Exam/Question.docx', 'CSC3150/考试资料/CSC3150_期末_试题.docx'],
  ['NTUO666/学习资料/ECE4016/HW2/Assignment 2.pdf', 'ECE4016/作业习题/ECE4016_作业_02_题目.pdf'],
  ['CSC3100/学习资料/CUHKSZ-CSC3100-EdgarFei/assignment1/CSC3100 Assignment 1.pdf', 'CSC3100/作业习题/CSC3100_作业_01_题目.pdf'],
  ['CSC3100/学习资料/CUHKSZ-CSC3100-EdgarFei/assignment3/CSC3100 Assignment 3-v1.pdf', 'CSC3100/作业习题/CSC3100_作业_03_题目.pdf'],
  ['CSC3100/学习资料/CUHKSZ-CSC3100-EdgarFei/assignment4/CSC3100 Assignment 4-v1.pdf', 'CSC3100/作业习题/CSC3100_作业_04_题目.pdf'],
  ['CSC3100/学习资料/CUHKSZ-CSC3100/Java-CSC3100/Assignment 1/CSC3100_Data_Structures_HW1_Fall_2024.pdf', 'CSC3100/作业习题/CSC3100_作业_01_题目_2024_秋季.pdf'],
  ['CSC3100/学习资料/CUHKSZ-CSC3100/C++-CSC3100/Assignment 2/CSC3100_Data_Structures_HW2_Fall_2024(1).pdf', 'CSC3100/作业习题/CSC3100_作业_02_题目_2024_秋季.pdf'],
  ['CSC3100/学习资料/CUHKSZ-CSC3100/C++-CSC3100/Assignment 3/CSC3100_Data_Structures_HW3_Fall_2024.pdf', 'CSC3100/作业习题/CSC3100_作业_03_题目_2024_秋季.pdf'],
  ['CSC3100/学习资料/CUHKSZ-CSC3100/C++-CSC3100/Assignment 4/CSC3100_Data_Structures_HW4_Fall_2024.pdf', 'CSC3100/作业习题/CSC3100_作业_04_题目_2024_秋季.pdf'],
  ['ECON3211/学习资料/ECON3211_PolicyEvaluationMethods/PS1_RCT/ECO3211 Problem Set 1.pdf', 'ECON3211/作业习题/ECON3211_作业_01_题目.pdf'],
  ['ECON3211/学习资料/ECON3211_PolicyEvaluationMethods/PS2_IV/ECO3211 Problem Set 2.pdf', 'ECON3211/作业习题/ECON3211_作业_02_题目.pdf'],
  ['ECON3211/学习资料/ECON3211_PolicyEvaluationMethods/PS3_DID/ECO3211 Problem Set 3.pdf', 'ECON3211/作业习题/ECON3211_作业_03_题目.pdf'],
  ['ECON3211/学习资料/ECON3211_PolicyEvaluationMethods/PS4_RDD/ECO3211 Problem Set 4.pdf', 'ECON3211/作业习题/ECON3211_作业_04_题目.pdf'],
  ['CSC3001/学习资料/离散数学课程资料/Assignment/assignment 2.pdf', 'CSC3001/作业习题/CSC3001_作业_02_题目.pdf'],
  ['CSC3001/学习资料/离散数学课程资料/Assignment/assignment 3.pdf', 'CSC3001/作业习题/CSC3001_作业_03_题目.pdf'],
  ['CSC3150/学习资料/课程资料/HW1/CSC3150-OS-AS1-2024.pdf', 'CSC3150/作业习题/CSC3150_作业_01_题目_2024.pdf'],
  ['CSC3150/学习资料/课程资料/HW2/CSC3150-OS-AS2_24fall.pdf', 'CSC3150/作业习题/CSC3150_作业_02_题目_2024_秋季.pdf'],
  ['CSC3150/学习资料/课程资料/HW3/CSC3150-OS-AS3-24fall.pdf', 'CSC3150/作业习题/CSC3150_作业_03_题目_2024_秋季.pdf'],
  ['CSC3150/学习资料/课程资料/HW4/CSC3150-Instruction-A4.pdf', 'CSC3150/作业习题/CSC3150_作业_04_题目.pdf'],
  ['CSC3150/学习资料/课程资料/HW3/Prerequisite Knowledge.pdf', 'CSC3150/学习资料/CSC3150_作业三_前置知识.pdf'],
  ['CSC3150/学习资料/课程资料/Final/Question (1) - 2ys ago.docx', 'CSC3150/考试资料/CSC3150_期末_往年题.docx'],
  ['CSC1003/学习资料/课程资料/Sildes', 'CSC1003/学习资料/Java基础课件'],
  ['CSC1003/学习资料/课程资料/Assignment/Assignment 3/CSC1003 Assignment 3.docx', 'CSC1003/作业习题/CSC1003_作业_03_题目.docx'],
  ['CSC1003/学习资料/课程资料/Assignment/Assignment 4/CSC1003 Assignment 4.docx', 'CSC1003/作业习题/CSC1003_作业_04_题目.docx'],
  ['CSC1003/学习资料/课程资料/Practice/Practice2/CSC1003 Practice Outline Sep26-30.pdf', 'CSC1003/作业习题/CSC1003_练习_02_题目.pdf'],
  ['CSC1003/学习资料/课程资料/Practice/Practice3/CSC1003 Practice Outline Oct10-14.pdf', 'CSC1003/作业习题/CSC1003_练习_03_题目.pdf'],
  ['CSC1003/学习资料/课程资料/Practice/Practice4/CSC1003 Practice Outline Oct 17-21.pdf', 'CSC1003/作业习题/CSC1003_练习_04_题目.pdf'],
  ['CSC1003/学习资料/课程资料/Practice/Practice5/CSC1003 Practice Outline Oct 24-28.pdf', 'CSC1003/作业习题/CSC1003_练习_05_题目.pdf'],
  ['CSC1003/学习资料/课程资料/Practice/Practice6/CSC1003 Practice Outline Oct31-Nov4.pdf', 'CSC1003/作业习题/CSC1003_练习_06_题目.pdf'],
  ['CSC3170/学习资料/课程资料/HW2/CSC3170_Assignment2.pdf', 'CSC3170/作业习题/CSC3170_作业_02_题目.pdf'],
  ['CSC3170/学习资料/课程资料/HW3/CSC3170_2024Fall_A3.pdf', 'CSC3170/作业习题/CSC3170_作业_03_题目_2024_秋季.pdf'],
  ['CSC3170/学习资料/课程资料/Project/Project-CSC3170.pdf', 'CSC3170/作业习题/CSC3170_项目_题目.pdf'],
  ['CSC3170/学习资料/课程资料/Final/final-review.pdf', 'CSC3170/学习资料/CSC3170_期末_复习资料.pdf'],
  ['CSC4160/学习资料/课程资料/Final/review.pdf', 'CSC4160/学习资料/CSC4160_期末_复习资料.pdf'],
  ['CSC4160/学习资料/课程资料/Final/sample.pdf.pdf', 'CSC4160/考试资料/CSC4160_期末_样卷.pdf'],
  ['MDS5102/学习资料/课程资料/hw1/MDS5102_Assignment_1.pdf', 'MDS5102/作业习题/MDS5102_作业_01_题目.pdf'],
  ['MDS5102/学习资料/课程资料/hw2/MDS5102_Assignment_2.pdf', 'MDS5102/作业习题/MDS5102_作业_02_题目.pdf'],
  ['MDS5102/学习资料/课程资料/hw3/MDS5102_Assignment_3.pdf', 'MDS5102/作业习题/MDS5102_作业_03_题目.pdf'],
  ['MDS5102/学习资料/课程资料/final/MDS5102_CourseProject_2021.pdf', 'MDS5102/作业习题/MDS5102_项目_题目_2021.pdf'],
  ['ECO3121/学习资料/ECO3121-Tut-Slides/README.md', 'ECO3121/学习资料/ECO3121_教程课件源码/README.md'],
]

function toUnix(relativePath) {
  return relativePath.split(path.sep).join('/')
}

async function exists(absolutePath) {
  try {
    await access(absolutePath)
    return true
  } catch {
    return false
  }
}

async function uniqueDestination(destination) {
  if (!(await exists(destination))) return destination
  const extension = path.extname(destination)
  const base = extension ? destination.slice(0, -extension.length) : destination
  for (let version = 2; ; version += 1) {
    const candidate = `${base}_v${version}${extension}`
    if (!(await exists(candidate))) return candidate
  }
}

async function move(relativeSource, relativeDestination) {
  const source = path.join(root, relativeSource)
  if (!(await exists(source))) return false
  const destination = await uniqueDestination(path.join(root, relativeDestination))
  console.log(`${toUnix(relativeSource)}  ->  ${toUnix(path.relative(root, destination))}`)
  if (apply) {
    await mkdir(path.dirname(destination), { recursive: true })
    await rename(source, destination)
  }
  return true
}

async function quarantine(relativeSource, bucket = '明确学生项目') {
  const source = path.join(root, relativeSource)
  if (!(await exists(source))) return false
  const destination = await uniqueDestination(path.join(reviewRoot, bucket, relativeSource))
  console.log(`隔离  ${toUnix(relativeSource)}  ->  ${destination}`)
  if (apply) {
    await mkdir(path.dirname(destination), { recursive: true })
    await rename(source, destination)
  }
  return true
}

async function cleanupEmptyDirectories(absolutePath) {
  let removed = 0
  const entries = await readdir(absolutePath, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue
    const child = path.join(absolutePath, entry.name)
    removed += await cleanupEmptyDirectories(child)
  }
  if (absolutePath !== root && (await readdir(absolutePath)).length === 0) {
    await rmdir(absolutePath)
    removed += 1
  }
  return removed
}

function courseCodeFromName(name) {
  return (name.match(/[A-Z]{2,5}\d{4}[A-Z]?/) || [])[0]
}

function examFolderToCourseDirectory(name) {
  const compactSeries = name.match(/^([A-Z]{2,5})(\d{4}(?::\d{4})+)/)
  if (compactSeries) return compactSeries[2].split(':').map((number) => `${compactSeries[1]}${number}`).join('&')
  const codes = [...name.matchAll(/[A-Z]{2,5}\d{4}[A-Z]?/g)].map((match) => match[0])
  return codes.length === 0 ? undefined : codes.join('&')
}

function examCollectionName(name) {
  if (/\b(?:mid|midterm)\b/i.test(name)) return '期中样卷'
  if (/\b(?:final)\b/i.test(name)) return '期末样卷'
  return '样卷汇总'
}

async function migrateNotes() {
  const source = path.join(root, noteSource)
  if (!(await exists(source))) return 0
  let count = 0
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '.git') continue
    const code = courseCodeFromName(entry.name)
    if (!code) continue
    const sourcePath = path.join(noteSource, entry.name)
    const destination = `${code}/学习资料/课程笔记`
    if (await move(sourcePath, destination)) count += 1
  }
  return count
}

async function migrateExams() {
  const source = path.join(root, examSource)
  if (!(await exists(source))) return 0
  let count = 0
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '.git') continue
    const code = examFolderToCourseDirectory(entry.name)
    if (!code) continue
    const sourcePath = path.join(examSource, entry.name)
    const destination = `${code}/考试资料/${examCollectionName(entry.name)}`
    if (await move(sourcePath, destination)) count += 1
  }
  return count
}

async function migrateKnownCollections() {
  let count = 0
  for (const [source, destination] of courseCollectionMoves) {
    if (await move(source, destination)) count += 1
  }
  return count
}

async function migrateNestedCollections() {
  let count = 0
  for (const [source, destination] of nestedCollectionMoves) {
    if (await move(source, destination)) count += 1
  }
  return count
}

async function extractKnownHandouts() {
  const candidates = [
    ['其他资料/学习资料/CSC_3150/Assignment-1/Assignment1-Handout.pdf', 'CSC3150/作业习题/CSC3150_作业_01_题目.pdf'],
    ['其他资料/学习资料/CSC_3150/Assignment-2/Assignment2-Handout.pdf', 'CSC3150/作业习题/CSC3150_作业_02_题目.pdf'],
    ['其他资料/学习资料/CSC_3150/Assignment-3/Assignment3-Handout.pdf', 'CSC3150/作业习题/CSC3150_作业_03_题目.pdf'],
    ['其他资料/学习资料/CSC_3150/Assignment-4/Assignment4-Handout.pdf', 'CSC3150/作业习题/CSC3150_作业_04_题目.pdf'],
  ]
  let count = 0
  for (const [source, destination] of candidates) {
    if (await move(source, destination)) count += 1
  }
  return count
}

async function extractConfirmedOfficialMaterials() {
  let count = 0
  for (const [source, destination] of confirmedOfficialMaterialMoves) {
    if (await move(source, destination)) count += 1
  }
  return count
}

const notes = await migrateNotes()
const exams = await migrateExams()
const knownCollections = await migrateKnownCollections()
const nestedCollections = await migrateNestedCollections()
const handouts = await extractKnownHandouts()
const officialMaterials = await extractConfirmedOfficialMaterials()
let quarantined = 0
for (const project of confirmedStudentProjects) {
  if (await quarantine(project)) quarantined += 1
}
let nonCourseQuarantined = 0
for (const item of otherItemsToReview) {
  if (await quarantine(item, '非课程或待确认资料')) nonCourseQuarantined += 1
}
let mixedCourseQuarantined = 0
for (const item of mixedCourseMaterialsToReview) {
  if (await quarantine(item, '混合课程资料待复核')) mixedCourseQuarantined += 1
}
let templates = 0
if (await move('其他资料/其他资料/CUHK-Shenzhen-Beamer-Template', '其他资料/课程通用模板/演示文稿模板')) templates += 1
if (await move('其他资料/其他资料/cuhksz_report_template', '其他资料/课程通用模板/课程报告模板')) templates += 1
const emptyDirectories = apply ? await cleanupEmptyDirectories(root) : 0
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', quarantined, migratedNoteCollections: notes, migratedExamCollections: exams, migratedKnownCollections: knownCollections, migratedNestedCollections: nestedCollections, extractedHandouts: handouts, extractedOfficialMaterials: officialMaterials, nonCourseQuarantined, mixedCourseQuarantined, preservedTemplates: templates, emptyDirectories }, null, 2))
