import { create } from 'zustand'
import type {
  AttendanceStatus,
  CallRecord,
  ClassRoom,
  PersistedState,
  PickMode,
  Student,
} from '@/types'
import { clearState, loadState, saveState } from '@/lib/storage'
import { pickBatch } from '@/lib/picker'
import { todayKey, uid } from '@/lib/utils'

interface RollCallState {
  /** 持久化字段 ---------- */
  version: number
  /** 全部班级（唯一数据源） */
  classes: ClassRoom[]
  activeClassId: string
  /** 全部班级的记录，靠 classId 归属 */
  allRecords: CallRecord[]
  settings: PersistedState['settings']

  /** 派生字段（当前班级的视图）---------- */
  students: Student[]
  records: CallRecord[]
  /** 当前班级的顺序游标 */
  sequentialCursor: number

  /** 运行时状态 ---------- */
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

  /** 班级操作 ---------- */
  setActiveClass: (classId: string) => void
  /** 新建班级；students 为空则建空班，后续可导入名单 */
  addClass: (name: string, students?: Student[]) => void
  renameClass: (classId: string, name: string) => void
  removeClass: (classId: string) => void
  /** 整体替换某班名单（批量导入后使用） */
  setClassStudents: (classId: string, students: Student[]) => void

  importState: (s: PersistedState) => void
}

const initial = loadState()

/**
 * 由「班级列表 + 当前班级 + 全部记录」推导出组件直接消费的视图。
 * 这样 StudentGrid / 统计 / 历史这些组件不用关心多班级的存在。
 */
function derive(classes: ClassRoom[], activeClassId: string, allRecords: CallRecord[]) {
  const active = classes.find((c) => c.id === activeClassId) ?? classes[0]
  if (!active) {
    return { activeClassId: '', students: [] as Student[], records: [] as CallRecord[], sequentialCursor: 0 }
  }
  return {
    activeClassId: active.id,
    students: active.students,
    records: allRecords.filter((r) => r.classId === active.id),
    sequentialCursor: active.cursor,
  }
}

/** 从完整状态中取出需要持久化的部分 */
function persistedOf(s: RollCallState): PersistedState {
  return {
    version: s.version,
    classes: s.classes,
    activeClassId: s.activeClassId,
    records: s.allRecords,
    settings: s.settings,
  }
}

/** 计算今日已点过的学生 id 集合 */
function calledTodayIds(records: CallRecord[], date: string): Set<string> {
  return new Set(records.filter((r) => r.date === date).map((r) => r.studentId))
}

/**
 * 整体替换某班名单，并把该班的历史记录按姓名重新挂到新 id 上。
 *
 * 导入名单会生成全新的学生 id，如果只按 id 过滤，老师上午点的名在下午重新导入一次名单后
 * 就全没了 —— 所以这里用姓名做桥接：人还在名单里，记录就得留着。
 */
function replaceClassStudents(
  classes: ClassRoom[],
  records: CallRecord[],
  classId: string,
  students: Student[],
): { classes: ClassRoom[]; allRecords: CallRecord[] } {
  const nextClasses = classes.map((c) => (c.id === classId ? { ...c, students, cursor: 0 } : c))
  const idByName = new Map(students.map((x) => [x.name, x.id]))
  const allRecords = records
    .filter((r) => r.classId !== classId || idByName.has(r.studentName))
    .map((r) => {
      if (r.classId !== classId) return r
      const nextId = idByName.get(r.studentName)
      return nextId && nextId !== r.studentId ? { ...r, studentId: nextId } : r
    })
  return { classes: nextClasses, allRecords }
}

/** 本次抽取结果的暂存区：仅动画期间使用，无需进入响应式状态 */
let pendingPicks: Student[] = []

export const useRollCallStore = create<RollCallState>((set, get) => ({
  version: initial.version,
  classes: initial.classes,
  allRecords: initial.records,
  settings: initial.settings,
  ...derive(initial.classes, initial.activeClassId, initial.records),

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

    set((s) => {
      // 游标记在当前班级上，切回来还能接着走
      const classes = s.classes.map((c) =>
        c.id === s.activeClassId ? { ...c, cursor: nextCursor } : c,
      )
      const next = { ...s, classes }
      saveState({ ...persistedOf(next) })
      return {
        classes,
        isRolling: true,
        currentPicks: [],
        rollingNames: picked.map((x) => x.name),
        sequentialCursor: nextCursor,
        // 候选不足时明确告知，避免"点了 5 个只出来 2 个"让人困惑
        notice:
          picked.length < settings.pickCount
            ? `可点人数不足，本次抽中 ${picked.length} 人`
            : null,
      }
    })
  },

  /** 动画结束：揭晓结果 */
  finishRoll: () => {
    set({ isRolling: false, currentPicks: pendingPicks, rollingNames: [] })
    pendingPicks = []
  },

  /** 标记某个学生的出勤状态，写入记录并移出待标记队列 */
  markStatus: (studentId, status) => {
    const { currentPicks, classes, activeClassId } = get()
    const target = currentPicks.find((s) => s.id === studentId)
    if (!target) return

    const now = new Date()
    const record: CallRecord = {
      id: uid('r'),
      classId: activeClassId,
      className: classes.find((c) => c.id === activeClassId)?.name ?? '',
      studentId: target.id,
      studentName: target.name,
      status,
      timestamp: now.toISOString(),
      date: todayKey(now),
    }

    set((s) => {
      const allRecords = [...s.allRecords, record]
      const next = { ...s, allRecords }
      saveState({ ...persistedOf(next) })
      return {
        allRecords,
        records: allRecords.filter((r) => r.classId === s.activeClassId),
        currentPicks: s.currentPicks.filter((x) => x.id !== studentId),
        notice: null,
      }
    })
  },

  dismissPick: (studentId) =>
    set((s) => ({ currentPicks: s.currentPicks.filter((x) => x.id !== studentId) })),

  clearPicks: () => set({ currentPicks: [] }),

  /** 撤销今日最后一条记录（只撤当前班级的） */
  undoLast: () => {
    const { records } = get()
    const date = todayKey()
    const lastIdx = [...records].reverse().findIndex((r) => r.date === date)
    if (lastIdx === -1) {
      set({ notice: '今日暂无可撤销的记录' })
      return
    }
    const realIdx = records.length - 1 - lastIdx
    const target = records[realIdx]

    set((s) => {
      const allRecords = s.allRecords.filter((r) => r.id !== target.id)
      const next = { ...s, allRecords }
      saveState({ ...persistedOf(next) })
      return {
        allRecords,
        records: allRecords.filter((r) => r.classId === s.activeClassId),
        notice: null,
      }
    })
  },

  /** 清空今日记录，开始新一轮（只影响当前班级） */
  resetToday: () => {
    const date = todayKey()
    set((s) => {
      const allRecords = s.allRecords.filter((r) => !(r.date === date && r.classId === s.activeClassId))
      const classes = s.classes.map((c) => (c.id === s.activeClassId ? { ...c, cursor: 0 } : c))
      const next = { ...s, allRecords, classes }
      saveState({ ...persistedOf(next) })
      return {
        allRecords,
        classes,
        records: allRecords.filter((r) => r.classId === s.activeClassId),
        sequentialCursor: 0,
        currentPicks: [],
        notice: '已开始新一轮点名',
      }
    })
  },

  /** 重置全部数据（恢复初始班级与名单，清空记录） */
  resetAll: () => {
    clearState()
    const fresh = loadState()
    pendingPicks = []
    set({
      version: fresh.version,
      classes: fresh.classes,
      allRecords: fresh.records,
      settings: fresh.settings,
      ...derive(fresh.classes, fresh.activeClassId, fresh.records),
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
      const classes = s.classes.map((c) => {
        if (c.id !== s.activeClassId) return c
        const maxNo = c.students.reduce((m, x) => Math.max(m, x.no), 0)
        return { ...c, students: [...c.students, { id: uid('s'), name: trimmed, no: maxNo + 1 }] }
      })
      const next = { ...s, classes }
      saveState({ ...persistedOf(next) })
      return { classes, ...derive(classes, s.activeClassId, s.allRecords) }
    })
  },

  removeStudent: (id) => {
    set((s) => {
      const classes = s.classes.map((c) =>
        c.id === s.activeClassId ? { ...c, students: c.students.filter((x) => x.id !== id) } : c,
      )
      // 连这个学生在当前班的所有记录一起删，避免名单里没人、统计里还有他
      const allRecords = s.allRecords.filter((r) => !(r.studentId === id && r.classId === s.activeClassId))
      const next = { ...s, classes, allRecords }
      saveState({ ...persistedOf(next) })
      return {
        classes,
        allRecords,
        ...derive(classes, s.activeClassId, allRecords),
        currentPicks: s.currentPicks.filter((x) => x.id !== id),
      }
    })
  },

  /** 切换班级：清空舞台上的抽取结果，避免上个班的名字挂在这 */
  setActiveClass: (classId) =>
    set((s) => {
      if (classId === s.activeClassId) return {}
      pendingPicks = []
      const view = derive(s.classes, classId, s.allRecords)
      saveState({ ...persistedOf({ ...s, activeClassId: view.activeClassId }) })
      return {
        ...view,
        currentPicks: [],
        rollingNames: [],
        isRolling: false,
        notice: null,
      }
    }),

  /** 新建班级：可带名单，建完直接切过去 */
  addClass: (name, students = []) =>
    set((s) => {
      const trimmed = name.trim()
      if (!trimmed) return {}
      // 同名班级复用 id，重复导入时是覆盖而不是出现两个一样的班
      const existing = s.classes.find((c) => c.name === trimmed)
      if (existing) {
        const { classes, allRecords } = replaceClassStudents(
          s.classes,
          s.allRecords,
          existing.id,
          students,
        )
        const view = derive(classes, existing.id, allRecords)
        saveState({ ...persistedOf({ ...s, classes, allRecords, activeClassId: view.activeClassId }) })
        return {
          classes,
          allRecords,
          ...view,
          currentPicks: [],
          rollingNames: [],
          isRolling: false,
          notice: `已更新 ${trimmed} 班名单（${students.length} 人）`,
        }
      }

      const created: ClassRoom = {
        id: uid('class'),
        name: trimmed,
        students,
        cursor: 0,
      }
      const classes = [...s.classes, created]
      const view = derive(classes, created.id, s.allRecords)
      saveState({ ...persistedOf({ ...s, classes, activeClassId: view.activeClassId }) })
      return {
        classes,
        ...view,
        currentPicks: [],
        rollingNames: [],
        isRolling: false,
        notice: `已添加 ${trimmed} 班（${students.length} 人）`,
      }
    }),

  renameClass: (classId, name) =>
    set((s) => {
      const trimmed = name.trim()
      if (!trimmed) return {}
      const classes = s.classes.map((c) => (c.id === classId ? { ...c, name: trimmed } : c))
      // 班级名快照也要跟着走，否则导出的历史 CSV 里还是旧班名
      const allRecords = s.allRecords.map((r) =>
        r.classId === classId ? { ...r, className: trimmed } : r,
      )
      const next = { ...s, classes, allRecords }
      saveState({ ...persistedOf(next) })
      return {
        classes,
        allRecords,
        ...derive(classes, s.activeClassId, allRecords),
        notice: `已重命名为 ${trimmed} 班`,
      }
    }),

  /** 删除班级：连同它的记录一起删；删的是当前班就切到第一个 */
  removeClass: (classId) =>
    set((s) => {
      if (s.classes.length <= 1) {
        return { notice: '至少保留一个班级' }
      }
      const classes = s.classes.filter((c) => c.id !== classId)
      const allRecords = s.allRecords.filter((r) => r.classId !== classId)
      const view = derive(classes, s.activeClassId === classId ? '' : s.activeClassId, allRecords)
      const next = { ...s, classes, allRecords, activeClassId: view.activeClassId }
      saveState({ ...persistedOf(next) })
      return {
        classes,
        allRecords,
        ...view,
        currentPicks: [],
        rollingNames: [],
        isRolling: false,
        notice: '已删除班级及其记录',
      }
    }),

  setClassStudents: (classId, students) =>
    set((s) => {
      const { classes, allRecords } = replaceClassStudents(
        s.classes,
        s.allRecords,
        classId,
        students,
      )
      const next = { ...s, classes, allRecords }
      saveState({ ...persistedOf(next) })
      return {
        classes,
        allRecords,
        ...derive(classes, s.activeClassId, allRecords),
        currentPicks: [],
        rollingNames: [],
        isRolling: false,
      }
    }),

  importState: (imported) => {
    saveState(imported)
    pendingPicks = []
    set({
      version: imported.version,
      classes: imported.classes,
      allRecords: imported.records,
      settings: imported.settings,
      ...derive(imported.classes, imported.activeClassId, imported.records),
      currentPicks: [],
      isRolling: false,
      rollingNames: [],
      notice: `已导入 ${imported.classes.length} 个班级、${imported.records.length} 条记录`,
    })
  },
}))

/** 选择器：今日记录 */
export const selectTodayRecords = (s: RollCallState): CallRecord[] => {
  const date = todayKey()
  return s.records.filter((r) => r.date === date)
}

/** 选择器：当前班级对象 */
export const selectActiveClass = (s: RollCallState): ClassRoom | undefined =>
  s.classes.find((c) => c.id === s.activeClassId) ?? s.classes[0]
