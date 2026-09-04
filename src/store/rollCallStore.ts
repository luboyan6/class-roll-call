import { create } from 'zustand'
import type { AttendanceStatus, CallRecord, PersistedState, PickMode, Student } from '@/types'
import { clearState, loadState, saveState } from '@/lib/storage'
import { pickBatch } from '@/lib/picker'
import { todayKey, uid } from '@/lib/utils'

interface RollCallState extends PersistedState {
  /** 是否正在滚动动画中 */
  isRolling: boolean
  /** 当前抽中、待标记出勤的学生（小组模式下可能多人） */
  currentPicks: Student[]
  /** 动画过程中滚动显示的临时名字 */
  rollingNames: string[]
  /** 点名模式 */
  mode: PickMode
  /** 是否跳过今日已点过的学生 */
  skipCalledToday: boolean
  /** 提示信息 */
  notice: string | null

  setMode: (m: PickMode) => void
  setSkipCalledToday: (v: boolean) => void
  setPickCount: (n: number) => void
  toggleSound: () => void
  startRoll: () => void
  finishRoll: () => void
  markStatus: (studentId: string, status: AttendanceStatus) => void
  /** 跳过某人，不记录出勤 */
  dismissPick: (studentId: string) => void
  clearPicks: () => void
  undoLast: () => void
  clearNotice: () => void
  resetToday: () => void
  resetAll: () => void
  addStudent: (name: string) => void
  removeStudent: (id: string) => void
  importState: (s: PersistedState) => void
}

const initial = loadState()

/** 从完整状态中取出需要持久化的部分（避免各处手写字段时漏掉 settings） */
function persistedOf(s: RollCallState): PersistedState {
  return {
    version: s.version,
    students: s.students,
    records: s.records,
    sequentialCursor: s.sequentialCursor,
    settings: s.settings,
  }
}

/** 计算今日已点过的学生 id 集合 */
function calledTodayIds(records: CallRecord[], date: string): Set<string> {
  return new Set(records.filter((r) => r.date === date).map((r) => r.studentId))
}

/** 本次抽取结果的暂存区：仅动画期间使用，无需进入响应式状态 */
let pendingPicks: Student[] = []

export const useRollCallStore = create<RollCallState>((set, get) => ({
  ...initial,
  isRolling: false,
  currentPicks: [],
  rollingNames: [],
  mode: 'weighted',
  skipCalledToday: true,
  notice: null,

  setMode: (m) => set({ mode: m }),
  setSkipCalledToday: (v) => set({ skipCalledToday: v }),
  clearNotice: () => set({ notice: null }),

  setPickCount: (n) =>
    set((s) => {
      // 切换人数时清空当前舞台上的抽中结果，避免"上一次抽了 5 人，切换到单人后旧名字还挂在上面"
      // 注意：sequentialCursor 不重置，sequential 模式是全名单推进；
      // 当前抽中/滚动状态清空，但不删任何已记录的数据
      const settings = { ...s.settings, pickCount: n }
      saveState({ ...persistedOf(s), settings })
      return {
        settings,
        currentPicks: [],
        rollingNames: [],
        isRolling: false,
        notice: null,
      }
    }),

  toggleSound: () =>
    set((s) => {
      const settings = { ...s.settings, soundEnabled: !s.settings.soundEnabled }
      saveState({ ...persistedOf(s), settings })
      return { settings }
    }),

  /** 开始点名：确定候选人，进入滚动状态 */
  startRoll: () => {
    const { students, records, skipCalledToday, mode, sequentialCursor, settings } = get()
    const date = todayKey()

    const called = calledTodayIds(records, date)
    const pool = skipCalledToday ? students.filter((s) => !called.has(s.id)) : students

    if (pool.length === 0) {
      set({
        notice: skipCalledToday
          ? '今日已全部点过，可关闭"跳过已点"或开始新一轮'
          : '暂无可点名学生',
      })
      return
    }

    const { picked, nextCursor } = pickBatch(
      pool,
      students,
      records,
      mode,
      sequentialCursor,
      settings.pickCount,
    )

    if (picked.length === 0) {
      set({ notice: '暂无可点名学生' })
      return
    }

    // 结果先算好，动画只是过程呈现
    pendingPicks = picked

    set({
      isRolling: true,
      currentPicks: [],
      rollingNames: picked.map((s) => s.name),
      sequentialCursor: nextCursor,
      // 候选不足时明确告知，避免"点了 5 个只出来 2 个"让人困惑
      notice:
        picked.length < settings.pickCount
          ? `可点人数不足，本次抽中 ${picked.length} 人`
          : null,
    })
  },

  /** 动画结束：揭晓结果 */
  finishRoll: () => {
    set({ isRolling: false, currentPicks: pendingPicks, rollingNames: [] })
    pendingPicks = []
  },

  /** 标记某个学生的出勤状态，写入记录并移出待标记队列 */
  markStatus: (studentId, status) => {
    const { currentPicks } = get()
    const target = currentPicks.find((s) => s.id === studentId)
    if (!target) return

    const now = new Date()
    const record: CallRecord = {
      id: uid(),
      studentId: target.id,
      studentName: target.name,
      status,
      timestamp: now.toISOString(),
      date: todayKey(now),
    }

    set((s) => {
      const records = [...s.records, record]
      saveState({ ...persistedOf(s), records })
      return {
        records,
        currentPicks: s.currentPicks.filter((x) => x.id !== studentId),
        notice: null,
      }
    })
  },

  dismissPick: (studentId) =>
    set((s) => ({ currentPicks: s.currentPicks.filter((x) => x.id !== studentId) })),

  clearPicks: () => set({ currentPicks: [] }),

  /** 撤销今日最后一条记录 */
  undoLast: () => {
    const { records } = get()
    const date = todayKey()
    const lastIdx = [...records].reverse().findIndex((r) => r.date === date)
    if (lastIdx === -1) {
      set({ notice: '今日暂无可撤销的记录' })
      return
    }
    const realIdx = records.length - 1 - lastIdx
    const nextRecords = records.filter((_, i) => i !== realIdx)

    set((s) => {
      saveState({ ...persistedOf(s), records: nextRecords })
      return { records: nextRecords, notice: null }
    })
  },

  /** 清空今日记录，开始新一轮 */
  resetToday: () => {
    const date = todayKey()
    set((s) => {
      const records = s.records.filter((r) => r.date !== date)
      saveState({ ...persistedOf(s), records, sequentialCursor: 0 })
      return { records, sequentialCursor: 0, currentPicks: [], notice: '已开始新一轮点名' }
    })
  },

  /** 重置全部数据（恢复初始名单，清空记录） */
  resetAll: () => {
    clearState()
    const fresh = loadState()
    pendingPicks = []
    set({
      ...fresh,
      currentPicks: [],
      isRolling: false,
      rollingNames: [],
      notice: '已重置全部数据',
    })
  },

  addStudent: (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    set((s) => {
      const maxNo = s.students.reduce((m, x) => Math.max(m, x.no), 0)
      const students = [...s.students, { id: uid(), name: trimmed, no: maxNo + 1 }]
      saveState({ ...persistedOf(s), students })
      return { students }
    })
  },

  removeStudent: (id) => {
    set((s) => {
      const students = s.students.filter((x) => x.id !== id)
      const records = s.records.filter((r) => r.studentId !== id)
      saveState({ ...persistedOf(s), students, records })
      return {
        students,
        records,
        currentPicks: s.currentPicks.filter((x) => x.id !== id),
      }
    })
  },

  importState: (imported) => {
    saveState(imported)
    pendingPicks = []
    set({
      ...imported,
      currentPicks: [],
      isRolling: false,
      rollingNames: [],
      notice: `已导入 ${imported.students.length} 名学生、${imported.records.length} 条记录`,
    })
  },
}))

/** 选择器：今日记录 */
export const selectTodayRecords = (s: RollCallState): CallRecord[] => {
  const date = todayKey()
  return s.records.filter((r) => r.date === date)
}
