import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { AttendanceStatus, StatusMeta } from '@/types'

/** 合并 tailwind 类名，后者覆盖前者冲突项 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 取 yyyy-MM-dd 格式的今天 */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 格式化为中文日期，如 2026年9月4日 */
export function formatChineseDate(d: Date = new Date()): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/** 格式化为周几 */
export function formatWeekday(d: Date = new Date()): string {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
}

/** 生成唯一 id */
export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 出勤状态元信息：集中管理，避免各处硬编码颜色。
 * 注意：不用 `current/30` 这类透明度修饰符 —— Tailwind 3 对 currentColor 的 alpha
 * 支持不可靠，亮暗模式下会渲染异常，故显式给出边框与淡底类名。
 */
export const STATUS_META: Record<AttendanceStatus, StatusMeta> = {
  present: {
    key: 'present',
    label: '到',
    textClass: 'text-present',
    bgClass: 'bg-present',
    bgSoftClass: 'bg-present/10',
    borderClass: 'border-present/30',
    hex: '#22C55E',
  },
  late: {
    key: 'late',
    label: '迟到',
    textClass: 'text-late',
    bgClass: 'bg-late',
    bgSoftClass: 'bg-late/10',
    borderClass: 'border-late/30',
    hex: '#F59E0B',
  },
  leave: {
    key: 'leave',
    label: '请假',
    textClass: 'text-leave',
    bgClass: 'bg-leave',
    bgSoftClass: 'bg-leave/10',
    borderClass: 'border-leave/30',
    hex: '#3B82F6',
  },
  absent: {
    key: 'absent',
    label: '缺勤',
    textClass: 'text-absent',
    bgClass: 'bg-absent',
    bgSoftClass: 'bg-absent/10',
    borderClass: 'border-absent/30',
    hex: '#EF4444',
  },
}

/** 状态展示顺序 */
export const STATUS_ORDER: AttendanceStatus[] = ['present', 'late', 'leave', 'absent']

/** 取姓氏（中文按首字，兼容复姓常见两字） */
const COMPOUND_SURNAMES = ['欧阳', '司马', '上官', '诸葛', '东方', '夏侯', '皇甫', '尉迟', '公孙', '慕容', '长孙', '宇文', '司徒', '轩辕']

export function surnameOf(name: string): string {
  if (!name) return '#'
  const two = name.slice(0, 2)
  if (COMPOUND_SURNAMES.includes(two)) return two
  return name.slice(0, 1)
}
