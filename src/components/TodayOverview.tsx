import { useMemo } from 'react'
import { useRollCallStore, selectTodayRecords } from '@/store/rollCallStore'
import { STATUS_META, STATUS_ORDER, cn, todayKey } from '@/lib/utils'
import type { AttendanceStatus } from '@/types'

export function TodayOverview() {
  const students = useRollCallStore((s) => s.students)
  const todayRecords = useRollCallStore(selectTodayRecords)

  const stats = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = {
      present: 0,
      late: 0,
      leave: 0,
      absent: 0,
    }
    for (const r of todayRecords) counts[r.status] += 1

    const called = todayRecords.length
    const total = students.length
    // 出勤率 = (到 + 迟到) / 已点人数；未点名不计入分母
    const effective = counts.present + counts.late + counts.leave + counts.absent
    const rate = effective === 0 ? 0 : Math.round(((counts.present + counts.late) / effective) * 100)

    return { counts, called, total, rate, remaining: Math.max(total - called, 0) }
  }, [todayRecords, students.length])

  const { counts, called, total, rate, remaining } = stats

  return (
    <section aria-label="今日概览" className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">今日概览</h2>
        <span className="text-xs text-muted-foreground">{todayKey()}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="已点名" value={`${called}/${total}`} />
        <Metric
          label="出勤率"
          value={called === 0 ? '—' : `${rate}%`}
          tone={called === 0 ? undefined : rate >= 90 ? 'good' : rate >= 75 ? 'warn' : 'bad'}
        />
        <Metric label="未点" value={String(remaining)} />
      </div>

      {/* 状态分布：横向堆叠条（较饼图更易读、可访问性更好） */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>出勤分布</span>
          <span className="tabular">{called} 条记录</span>
        </div>

        {called === 0 ? (
          <div className="h-2 w-full rounded-full bg-muted" aria-hidden="true" />
        ) : (
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {STATUS_ORDER.map((key) => {
              const n = counts[key]
              if (n === 0) return null
              return (
                <div
                  key={key}
                  className={cn(STATUS_META[key].bgClass, 'h-full transition-all duration-300')}
                  style={{ width: `${(n / called) * 100}%` }}
                  title={`${STATUS_META[key].label} ${n} 人`}
                />
              )
            })}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          {STATUS_ORDER.map((key) => {
            const meta = STATUS_META[key]
            return (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className={cn('inline-block h-2 w-2 rounded-sm', meta.bgClass)}
                    aria-hidden="true"
                  />
                  {meta.label}
                </span>
                <span className={cn('tabular font-medium', meta.textClass)}>{counts[key]}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'warn' | 'bad'
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3 text-center">
      <div
        className={cn(
          'tabular text-xl font-semibold leading-tight',
          tone === 'good' && 'text-present',
          tone === 'warn' && 'text-late',
          tone === 'bad' && 'text-absent',
          !tone && 'text-foreground',
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}
