/** 出勤状态 */
export type AttendanceStatus = 'present' | 'late' | 'leave' | 'absent'

/** 点名模式 */
export type PickMode = 'random' | 'sequential' | 'weighted'

/** 学生 */
export interface Student {
  id: string
  name: string
  /** 学号（可选，按名单顺序自动生成） */
  no: number
}

/** 单条点名记录 */
export interface CallRecord {
  id: string
  studentId: string
  studentName: string
  status: AttendanceStatus
  /** ISO 时间戳 */
  timestamp: string
  /** 所属日期 yyyy-MM-dd */
  date: string
}

/** 用户设置（随数据一并持久化与备份） */
export interface Settings {
  /** 音效开关：默认关闭，避免课堂环境突兀出声 */
  soundEnabled: boolean
  /** 单次抽取人数：1 个人点名，或 3/5 人小组提问 */
  pickCount: number
}

/** 持久化数据结构 */
export interface PersistedState {
  version: number
  students: Student[]
  records: CallRecord[]
  /** 顺序模式的游标 */
  sequentialCursor: number
  settings: Settings
}

/** 状态元信息（展示用） */
export interface StatusMeta {
  key: AttendanceStatus
  label: string
  /** tailwind 文本色类名 */
  textClass: string
  /** tailwind 实心背景类名（图例、色块） */
  bgClass: string
  /** tailwind 淡背景类名（卡片、标签底色） */
  bgSoftClass: string
  /** tailwind 边框类名 */
  borderClass: string
  /** 图表用的原始色值 */
  hex: string
}
