import type {
  AttendanceStatus,
  CallRecord,
  ClassRoom,
  LegacyPersistedState,
  PersistedState,
  Settings,
  Student,
} from '@/types'
import { createSeedClasses } from './seed'
import { STATUS_META, todayKey, uid } from './utils'

/**
 * key 名沿用 v1：换 key 会让老用户已有的点名记录凭空消失，
 * 版本号升级交给 STATE_VERSION + 迁移逻辑处理。
 */
const STORAGE_KEY = 'roll-call-state-v1'
export const STATE_VERSION = 3
/** 旧版默认班级名：v1/v2 只有一个班，迁移后统一叫 2501 */
const LEGACY_CLASS_NAME = '2501'

/** 可选的单次抽取人数 */
export const PICK_COUNT_OPTIONS = [1, 3, 5] as const

/** 默认设置 */
export function createDefaultSettings(): Settings {
  return {
    soundEnabled: false,
    pickCount: 1,
  }
}

/** 规范化设置：补齐缺失字段、修正非法值 */
function normalizeSettings(raw: Partial<Settings> | undefined | null): Settings {
  const fallback = createDefaultSettings()
  if (!raw || typeof raw !== 'object') return fallback

  const pickCount = Number(raw.pickCount)
  return {
    soundEnabled: typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : fallback.soundEnabled,
    pickCount: PICK_COUNT_OPTIONS.includes(pickCount as (typeof PICK_COUNT_OPTIONS)[number])
      ? pickCount
      : fallback.pickCount,
  }
}

/** 默认状态：2501 + 2503 两个班 */
export function createInitialState(): PersistedState {
  const classes = createSeedClasses()
  return {
    version: STATE_VERSION,
    classes,
    activeClassId: classes[0].id,
    records: [],
    settings: createDefaultSettings(),
  }
}

/** 学生字段规范化：补齐 id / 学号，丢弃空名 */
function normalizeStudent(raw: Partial<Student> | null | undefined, index: number): Student | null {
  if (!raw || typeof raw.name !== 'string') return null
  const name = raw.name.trim()
  if (!name) return null
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `s${String(index + 1).padStart(2, '0')}`,
    name,
    no: typeof raw.no === 'number' && raw.no > 0 ? raw.no : index + 1,
  }
}

/** 班级字段规范化 */
function normalizeClass(raw: Partial<ClassRoom> | null | undefined, index: number): ClassRoom | null {
  if (!raw || typeof raw !== 'object') return null
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `班级${index + 1}`
  const students = Array.isArray(raw.students)
    ? raw.students.map(normalizeStudent).filter((s): s is Student => s !== null)
    : []
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid('class'),
    name,
    students,
    cursor: typeof raw.cursor === 'number' && raw.cursor >= 0 ? raw.cursor : 0,
  }
}

const VALID_STATUS: AttendanceStatus[] = ['present', 'late', 'leave', 'absent']

/** 记录字段规范化：缺班级归属的记录会被挂到 fallbackClassId 上 */
function normalizeRecord(
  raw: Partial<CallRecord> | null | undefined,
  fallbackClassId: string,
  fallbackClassName: string,
): CallRecord | null {
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.studentId !== 'string' || typeof raw.date !== 'string') return null
  if (typeof raw.timestamp !== 'string' || typeof raw.studentName !== 'string') return null
  if (!VALID_STATUS.includes(raw.status as AttendanceStatus)) return null

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid('r'),
    classId: typeof raw.classId === 'string' && raw.classId ? raw.classId : fallbackClassId,
    className:
      typeof raw.className === 'string' && raw.className ? raw.className : fallbackClassName,
    studentId: raw.studentId,
    studentName: raw.studentName,
    status: raw.status as AttendanceStatus,
    timestamp: raw.timestamp,
    date: raw.date,
  }
}

/**
 * v1/v2 → v3 迁移。
 * 老数据只有一个班，把它整体包成 2501 班；老记录补上 classId。
 * 用户已有的点名历史不能丢，这是这个文件里最要紧的一件事。
 */
function migrateLegacy(parsed: LegacyPersistedState): PersistedState | null {
  if (!Array.isArray(parsed.students)) return null

  const students = parsed.students
    .map(normalizeStudent)
    .filter((s): s is Student => s !== null)
  if (students.length === 0) return null

  const legacyClass: ClassRoom = {
    id: `class-${LEGACY_CLASS_NAME}`,
    name: LEGACY_CLASS_NAME,
    students,
    cursor:
      typeof parsed.sequentialCursor === 'number' && parsed.sequentialCursor >= 0
        ? parsed.sequentialCursor
        : 0,
  }

  const records = Array.isArray(parsed.records)
    ? parsed.records
        .map((r) => normalizeRecord(r, legacyClass.id, legacyClass.name))
        .filter((r): r is CallRecord => r !== null)
    : []

  return {
    version: STATE_VERSION,
    classes: [legacyClass],
    activeClassId: legacyClass.id,
    records,
    settings: normalizeSettings(parsed.settings),
  }
}

/** 读取本地状态，损坏或版本不符时回退到初始状态 */
export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialState()

    const parsed = JSON.parse(raw) as Partial<PersistedState> & LegacyPersistedState
    if (!parsed || typeof parsed !== 'object') return createInitialState()

    // 来自更高版本的数据（结构未知）才回退
    if (typeof parsed.version === 'number' && parsed.version > STATE_VERSION) {
      return createInitialState()
    }

    // v3：已经是多班级结构
    if (Array.isArray(parsed.classes)) {
      const classes = parsed.classes
        .map(normalizeClass)
        .filter((c): c is ClassRoom => c !== null)
      if (classes.length === 0) return createInitialState()

      // activeClassId 可能指向已被删除的班级，回落到第一个
      const activeClassId = classes.some((c) => c.id === parsed.activeClassId)
        ? (parsed.activeClassId as string)
        : classes[0].id
      const fallbackName = classes.find((c) => c.id === activeClassId)?.name ?? classes[0].name

      const records = Array.isArray(parsed.records)
        ? parsed.records
            .map((r) => normalizeRecord(r, activeClassId, fallbackName))
            .filter((r): r is CallRecord => r !== null)
        : []

      return {
        version: STATE_VERSION,
        classes,
        activeClassId,
        records,
        settings: normalizeSettings(parsed.settings),
      }
    }

    // v1/v2：单班级结构，迁移成 2501 班
    const migrated = migrateLegacy(parsed)
    return migrated ?? createInitialState()
  } catch {
    // localStorage 不可用或数据损坏 —— 静默回退，不阻塞使用
    return createInitialState()
  }
}

/** 写入本地状态，配额超限等异常不抛出到 UI */
export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 忽略：隐私模式 / 配额满
  }
}

/** 清除本地状态 */
export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 忽略
  }
}

/** 导出为 CSV（带 BOM，保证 Excel 打开中文不乱码） */
export function exportRecordsToCSV(records: CallRecord[], filename?: string): void {
  const header = ['日期', '时间', '班级', '姓名', '出勤状态']
  const rows = records.map((r) => {
    const d = new Date(r.timestamp)
    const time = Number.isNaN(d.getTime())
      ? ''
      : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
    return [
      r.date,
      time,
      r.className ?? '',
      r.studentName,
      STATUS_META[r.status]?.label ?? r.status,
    ]
  })

  const csv = [header, ...rows]
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `点名记录_${todayKey()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 导出完整数据为 JSON（用于备份/迁移） */
export function exportStateToJSON(state: PersistedState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `点名数据备份_${todayKey()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 解析导入的 JSON，做基本校验。
 * v3 的多班级备份、v1/v2 的老备份都吃：老备份走同一套迁移逻辑包成 2501 班。
 */
export function parseImportedState(raw: string): PersistedState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState> & LegacyPersistedState
    if (!parsed || typeof parsed !== 'object') return null

    // v3 结构
    if (Array.isArray(parsed.classes)) {
      const classes = parsed.classes
        .map(normalizeClass)
        .filter((c): c is ClassRoom => c !== null)
      if (classes.length === 0) return null

      const activeClassId = classes.some((c) => c.id === parsed.activeClassId)
        ? (parsed.activeClassId as string)
        : classes[0].id
      const fallbackName = classes.find((c) => c.id === activeClassId)?.name ?? classes[0].name
      const records = Array.isArray(parsed.records)
        ? parsed.records
            .map((r) => normalizeRecord(r, activeClassId, fallbackName))
            .filter((r): r is CallRecord => r !== null)
        : []

      return {
        version: STATE_VERSION,
        classes,
        activeClassId,
        records,
        settings: normalizeSettings(parsed.settings),
      }
    }

    // v1/v2 结构
    return migrateLegacy(parsed)
  } catch {
    return null
  }
}

/** 名单解析结果：一次粘贴可能包含多个班 */
export interface ParsedRoster {
  className: string
  students: Student[]
}

const GENDER_VALUES = new Set(['男', '女', 'male', 'female', 'M', 'F'])
/** 表头关键字，遇到就跳过这一行 */
const HEADER_HINT = /序号|姓名|班级|性别|name|class/i

/**
 * 解析粘贴进来的名单文本。
 *
 * 支持这些形态（逗号、中文逗号、制表符、空格都能分隔）：
 *   序号,姓名,班级,性别        ← 表头，自动跳过
 *   1,张茜,2503,女
 *   张茜                      ← 只有姓名，班级用 fallbackClassName
 *
 * 性别列会被读出来用于定位列，但不入库（老师明确说不需要）。
 * 班级列是 3 位以上纯数字（2503）或含"班"字的字符串。
 */
export function parseRosterText(text: string, fallbackClassName = ''): ParsedRoster[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const buckets = new Map<string, Student[]>()

  for (const line of lines) {
    if (HEADER_HINT.test(line) && /[,，\t]/.test(line)) continue

    const cols = line
      .split(/[,，\t]+/)
      .map((c) => c.trim())
      .filter(Boolean)
    if (cols.length === 0) continue

    // 去掉开头的序号列
    const body = /^\d+$/.test(cols[0]) && cols.length > 1 ? cols.slice(1) : cols

    // 性别列只用来排除，不保存
    const rest = body.filter((c) => !GENDER_VALUES.has(c))
    if (rest.length === 0) continue

    // 班级列：纯数字且长度 ≥ 3，或形如"2503班"
    const classIdx = rest.findIndex((c) => /^\d{3,}$/.test(c) || /^\d{3,}\s*班$/.test(c))
    const className = classIdx >= 0 ? rest[classIdx].replace(/\s*班$/, '') : fallbackClassName

    const nameCandidates = rest.filter((_, i) => i !== classIdx)
    const name = nameCandidates[0]
    // 姓名应当是中文或字母，长度 1~8；其余情况视为脏数据
    if (!name || !/^[一-龥A-Za-z·]{1,8}$/.test(name)) continue

    const list = buckets.get(className) ?? []
    list.push({ id: uid('s'), name, no: list.length + 1 })
    buckets.set(className, list)
  }

  return [...buckets.entries()]
    .filter(([, students]) => students.length > 0)
    .map(([className, students]) => ({ className, students }))
}
