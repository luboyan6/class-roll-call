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

/**
 * 班级 —— 名单、点名记录、顺序游标都按班级隔离。
 * 老师可能同时带几个班，切换班级后看到的应该是另一个班的人和另一个班的记录。
 */
export interface ClassRoom {
  id: string
  name: string
  students: Student[]
  /** 顺序轮询模式的游标，每个班各自推进 */
  cursor: number
}

/** 单条点名记录 */
export interface CallRecord {
  id: string
  /** 所属班级（记录按班级隔离） */
  classId: string
  /** 班级名快照：导出 CSV 时即便班级被改名/删除也能看懂历史 */
  className: string
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
  /** 背景音乐开关 */
  bgmEnabled: boolean
  /** 背景音乐音量 0~1 */
  bgmVolume: number
}

/** 持久化数据结构（v3 起按班级组织） */
export interface PersistedState {
  version: number
  classes: ClassRoom[]
  /** 当前选中的班级 */
  activeClassId: string
  /** 全部班级的点名记录，靠 classId 归属 */
  records: CallRecord[]
  settings: Settings
}

/**
 * 旧版（v1/v2）落盘结构 —— 仅用于迁移。
 * 那时只有一个班，名单直接挂在根节点上。
 */
export interface LegacyPersistedState {
  version?: number
  students?: Student[]
  records?: Omit<CallRecord, 'classId' | 'className'>[]
  sequentialCursor?: number
  settings?: Settings
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
