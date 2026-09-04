import type {
  AttendanceStatus,
  CallRecord,
  PersistedState,
  Settings,
  Student,
} from '@/types'
import { createSeedStudents } from './seed'
import { STATUS_META, todayKey } from './utils'

/**
 * key 名沿用 v1：换 key 会让老用户已有的点名记录凭空消失，
 * 版本号升级交给 STATE_VERSION + 迁移逻辑处理。
 */
const STORAGE_KEY = 'roll-call-state-v1'
export const STATE_VERSION = 2

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

/** 默认状态 */
export function createInitialState(): PersistedState {
  return {
    version: STATE_VERSION,
    students: createSeedStudents(),
    records: [],
    sequentialCursor: 0,
    settings: createDefaultSettings(),
  }
}

/** 读取本地状态，损坏或版本不符时回退到初始状态 */
export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialState()

    const parsed = JSON.parse(raw) as Partial<PersistedState>
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.students)) {
      return createInitialState()
    }
    // 来自更高版本的数据（结构未知）才回退；v1 数据缺 settings，走迁移补默认值
    if (typeof parsed.version === 'number' && parsed.version > STATE_VERSION) {
      return createInitialState()
    }

    return {
      version: STATE_VERSION,
      students: parsed.students,
      records: Array.isArray(parsed.records) ? parsed.records : [],
      sequentialCursor: typeof parsed.sequentialCursor === 'number' ? parsed.sequentialCursor : 0,
      settings: normalizeSettings(parsed.settings),
    }
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
  const header = ['日期', '时间', '姓名', '出勤状态']
  const rows = records.map((r) => {
    const d = new Date(r.timestamp)
    const time = Number.isNaN(d.getTime())
      ? ''
      : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
    return [r.date, time, r.studentName, STATUS_META[r.status]?.label ?? r.status]
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

/** 解析导入的 JSON，做基本校验 */
export function parseImportedState(raw: string): PersistedState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    if (!parsed || !Array.isArray(parsed.students) || parsed.students.length === 0) return null

    const students: Student[] = parsed.students
      .filter((s): s is Student => !!s && typeof s.name === 'string' && s.name.trim() !== '')
      .map((s, i) => ({
        id: typeof s.id === 'string' && s.id ? s.id : `s${String(i + 1).padStart(2, '0')}`,
        name: s.name.trim(),
        no: typeof s.no === 'number' ? s.no : i + 1,
      }))

    if (students.length === 0) return null

    const validStatus: AttendanceStatus[] = ['present', 'late', 'leave', 'absent']
    const records: CallRecord[] = Array.isArray(parsed.records)
      ? parsed.records.filter(
          (r): r is CallRecord =>
            !!r &&
            typeof r.id === 'string' &&
            typeof r.studentId === 'string' &&
            typeof r.studentName === 'string' &&
            typeof r.date === 'string' &&
            typeof r.timestamp === 'string' &&
            validStatus.includes(r.status),
        )
      : []

    return {
      version: STATE_VERSION,
      students,
      records,
      sequentialCursor: typeof parsed.sequentialCursor === 'number' ? parsed.sequentialCursor : 0,
      settings: normalizeSettings(parsed.settings),
    }
  } catch {
    return null
  }
}
