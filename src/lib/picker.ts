import type { CallRecord, PickMode, Student } from '@/types'

/**
 * 点名算法
 *
 * 三种模式：
 * - random：纯随机，等概率
 * - sequential：顺序轮询，按名单游标推进
 * - weighted：加权随机 —— 被点次数越少权重越高，长期趋于公平
 */

/** 统计每个学生的历史被点次数 */
export function buildCallCounts(students: Student[], records: CallRecord[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const s of students) counts.set(s.id, 0)
  for (const r of records) {
    counts.set(r.studentId, (counts.get(r.studentId) ?? 0) + 1)
  }
  return counts
}

/**
 * 加权随机：权重 = (maxCount - count + 1) ^ 1.5
 * 加 1 保证被点最少的人权重不为 0；指数 1.5 放大差距但不至于完全剥夺高频者的机会。
 */
function weightedPick(students: Student[], counts: Map<string, number>): Student {
  const values = students.map((s) => counts.get(s.id) ?? 0)
  const max = Math.max(...values, 0)
  const weights = students.map((s) => Math.pow(max - (counts.get(s.id) ?? 0) + 1, 1.5))

  const total = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  for (let i = 0; i < students.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return students[i]
  }
  return students[students.length - 1]
}

/** 纯随机：返回候选数组下标 */
function randomIndex(students: Student[]): number {
  return Math.floor(Math.random() * students.length)
}

/**
 * 主入口：按模式选人
 * @param students 候选学生（已过滤掉本次不想再点的人）
 * @param records 历史记录（加权模式使用）
 * @param mode 模式
 * @param cursor 顺序模式游标
 * @returns 选中的学生在数组中的下标，候选为空时返回 -1
 */
export function pickIndex(
  students: Student[],
  records: CallRecord[],
  mode: PickMode,
  cursor: number,
): number {
  if (students.length === 0) return -1

  switch (mode) {
    case 'sequential': {
      const idx = ((cursor % students.length) + students.length) % students.length
      return idx
    }
    case 'weighted': {
      const counts = buildCallCounts(students, records)
      const chosen = weightedPick(students, counts)
      return students.findIndex((s) => s.id === chosen.id)
    }
    case 'random':
    default:
      return randomIndex(students)
  }
}

/**
 * 批量抽取：一次选出 count 个互不重复的学生（小组提问）
 *
 * - sequential：从游标位置沿全量名单推进，跳过不在候选池中的（今日已点），凑够即止
 * - random / weighted：逐个从候选池抽取并移出，保证同一批内不重复；
 *   weighted 每次重算权重，第二个人仍倾向"被点少"的同学
 *
 * @param candidates 候选池（已过滤今日已点）
 * @param allStudents 全量名单（顺序模式推进用）
 * @returns picked 选中的学生；nextCursor 推进后的游标
 */
export function pickBatch(
  candidates: Student[],
  allStudents: Student[],
  records: CallRecord[],
  mode: PickMode,
  cursor: number,
  count: number,
): { picked: Student[]; nextCursor: number } {
  if (candidates.length === 0 || allStudents.length === 0 || count <= 0) {
    return { picked: [], nextCursor: cursor }
  }

  const size = Math.min(count, candidates.length)
  const picked: Student[] = []

  if (mode === 'sequential') {
    const candidateIds = new Set(candidates.map((s) => s.id))
    let i = ((cursor % allStudents.length) + allStudents.length) % allStudents.length
    let guard = 0
    // 最多遍历一整圈，候选不足时提前结束
    while (picked.length < size && guard < allStudents.length) {
      const s = allStudents[i]
      if (candidateIds.has(s.id)) picked.push(s)
      i = (i + 1) % allStudents.length
      guard++
    }
  } else {
    const pool = [...candidates]
    for (let k = 0; k < size; k++) {
      const idx = pickIndex(pool, records, mode, k)
      if (idx < 0) break
      picked.push(pool.splice(idx, 1)[0])
    }
  }

  // 游标推进到最后一位的下一位，方便切回顺序模式时接着走
  const last = picked[picked.length - 1]
  const nextCursor = last ? allStudents.findIndex((s) => s.id === last.id) + 1 : cursor

  return { picked, nextCursor }
}
