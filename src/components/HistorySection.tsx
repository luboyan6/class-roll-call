import { useMemo } from 'react'
import { Undo2 } from 'lucide-react'
import { useRollCallStore } from '@/store/rollCallStore'
import type { CallRecord } from '@/types'
import { STATUS_META, cn, todayKey } from '@/lib/utils'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'

const MAX_DAYS = 7

export function HistorySection() {
  const records = useRollCallStore((s) => s.records)
  const undoLast = useRollCallStore((s) => s.undoLast)
  const today = todayKey()

  /** 按日期倒序分组，只保留最近若干天 */
  const grouped = useMemo(() => {
    const map = new Map<string, CallRecord[]>()
    for (const r of records) {
      const list = map.get(r.date) ?? []
      list.push(r)
      map.set(r.date, list)
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, MAX_DAYS)
      .map(([date, list]) => ({
        date,
        // 同日内按时间倒序，最近点的在最上面
        list: [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
      }))
  }, [records])

  return (
    <section aria-label="历史记录" className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-sm font-semibold">历史记录</h2>
          <p className="text-xs text-muted-foreground">最近 {MAX_DAYS} 天</p>
        </div>
        <Button variant="outline" size="sm" onClick={undoLast} disabled={records.length === 0}>
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          撤销今日最后一条
        </Button>
      </div>

      {grouped.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">暂无历史记录</p>
      ) : (
        <div className="divide-y divide-border">
          {grouped.map(({ date, list }) => (
            <div key={date} className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{date}</span>
                {date === today && (
                  <Badge variant="outline" className="border-accent/30 text-accent">
                    今天
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{list.length} 条</span>
              </div>

              <ul className="space-y-1.5">
                {list.map((r) => {
                  const meta = STATUS_META[r.status]
                  const d = new Date(r.timestamp)
                  const time = Number.isNaN(d.getTime())
                    ? '—'
                    : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                  return (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors duration-200 hover:bg-muted"
                    >
                      <span className="tabular w-12 shrink-0 text-xs text-muted-foreground">
                        {time}
                      </span>
                      <span className="flex-1 truncate font-medium">{r.studentName}</span>
                      <Badge variant={r.status}>
                        <span
                          className={cn('inline-block h-1.5 w-1.5 rounded-sm', meta.bgClass)}
                          aria-hidden="true"
                        />
                        {meta.label}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
