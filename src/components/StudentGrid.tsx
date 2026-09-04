import { useMemo, useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { useRollCallStore } from '@/store/rollCallStore'
import type { AttendanceStatus, Student } from '@/types'
import { STATUS_META, cn, surnameOf, todayKey } from '@/lib/utils'

interface StudentGridProps {
  /** 紧凑模式用于侧栏展示 */
  compact?: boolean
}

export function StudentGrid({ compact = false }: StudentGridProps) {
  const students = useRollCallStore((s) => s.students)
  const records = useRollCallStore((s) => s.records)
  const removeStudent = useRollCallStore((s) => s.removeStudent)
  const [query, setQuery] = useState('')

  /** 今日各学生状态 */
  const todayStatus = useMemo(() => {
    const date = todayKey()
    const map = new Map<string, AttendanceStatus>()
    for (const r of records) {
      if (r.date === date) map.set(r.studentId, r.status)
    }
    return map
  }, [records])

  /** 按姓氏分组 */
  const groups = useMemo(() => {
    const q = query.trim()
    const filtered = q ? students.filter((s) => s.name.includes(q)) : students

    const map = new Map<string, Student[]>()
    for (const s of filtered) {
      const key = surnameOf(s.name)
      const list = map.get(key) ?? []
      list.push(s)
      map.set(key, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans-CN'))
  }, [students, query])

  const gridClass = compact
    ? 'grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3'
    : 'grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'

  return (
    <section aria-label="学生名单" className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-sm font-semibold">学生名单</h2>
          <p className="text-xs text-muted-foreground">共 {students.length} 人</p>
        </div>
        {!compact && (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索姓名"
              aria-label="搜索学生姓名"
              className="h-8 w-32 rounded-md border border-border bg-background pl-8 pr-2 text-xs text-foreground transition-colors duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-40"
            />
          </div>
        )}
      </div>

      <div className="max-h-[28rem] space-y-4 overflow-y-auto p-4">
        {groups.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">未找到匹配的学生</p>
        )}

        {groups.map(([surname, list]) => (
          <div key={surname}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{surname}</span>
              <span className="text-xs text-muted-foreground/60">({list.length})</span>
            </div>
            <div className={gridClass}>
              {list.map((s) => {
                const status = todayStatus.get(s.id)
                const meta = status ? STATUS_META[status] : null
                return (
                  <div
                    key={s.id}
                    className={cn(
                      'group relative flex min-h-10 items-center justify-center rounded-md border px-8 py-1.5 text-xs transition-colors duration-200',
                      meta
                        ? `${meta.textClass} ${meta.borderClass} ${meta.bgSoftClass}`
                        : 'border-border bg-background text-foreground',
                    )}
                    title={meta ? `${s.name} · ${meta.label}` : `${s.name} · 未点名`}
                  >
                    <span className="max-w-full truncate text-center font-medium">{s.name}</span>
                    <span className="absolute right-2 flex items-center gap-1">
                      {meta && <span className="text-[10px] opacity-80">{meta.label}</span>}
                      {!compact && (
                        <button
                          type="button"
                          onClick={() => removeStudent(s.id)}
                          aria-label={`删除 ${s.name}`}
                          className="cursor-pointer rounded p-0.5 opacity-0 transition-opacity duration-200 hover:bg-border focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {compact && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2.5 text-[10px] text-muted-foreground">
          {(['present', 'late', 'leave', 'absent'] as AttendanceStatus[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span
                className={cn('inline-block h-2 w-2 rounded-sm', STATUS_META[k].bgClass)}
                aria-hidden="true"
              />
              {STATUS_META[k].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-border" aria-hidden="true" />
            未点
          </span>
        </div>
      )}
    </section>
  )
}
