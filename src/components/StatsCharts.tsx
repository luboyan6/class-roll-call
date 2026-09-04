import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { useRollCallStore } from '@/store/rollCallStore'
import { buildCallCounts } from '@/lib/picker'
import { STATUS_META, STATUS_ORDER, cn } from '@/lib/utils'

/** 轴线/文字用中性色，亮暗模式下均可读 */
const AXIS_COLOR = '#94A3B8'
const BAR_COLOR = '#3B82F6'

export function StatsCharts() {
  const students = useRollCallStore((s) => s.students)
  const records = useRollCallStore((s) => s.records)

  /** 全部学生的被点次数（降序），同时供图表与无障碍数据表使用 */
  const fullRanking = useMemo(() => {
    const counts = buildCallCounts(students, records)
    return students
      .map((s) => ({ id: s.id, name: s.name, count: counts.get(s.id) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'))
  }, [students, records])

  /** 图表只取前 10，避免坐标轴拥挤 */
  const ranking = useMemo(() => fullRanking.slice(0, 10), [fullRanking])

  /** 历史累计出勤分布（全部记录） */
  const distribution = useMemo(() => {
    const counts: Record<string, number> = { present: 0, late: 0, leave: 0, absent: 0 }
    for (const r of records) counts[r.status] = (counts[r.status] ?? 0) + 1
    return { counts, total: records.length }
  }, [records])

  /** 历史出勤率 */
  const historyRate = useMemo(() => {
    const { counts, total } = distribution
    if (total === 0) return 0
    return Math.round(((counts.present + counts.late) / total) * 100)
  }, [distribution])

  if (records.length === 0) {
    return (
      <section aria-label="统计" className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">统计</h2>
        <p className="mt-3 text-sm text-muted-foreground">暂无记录，点名后这里会显示统计图表。</p>
      </section>
    )
  }

  const maxCount = ranking[0]?.count ?? 0

  return (
    <section aria-label="统计" className="space-y-5 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">统计</h2>
        <span className="text-xs text-muted-foreground">
          累计 {records.length} 条 · 历史出勤率{' '}
          <span
            className={cn(
              'tabular font-medium',
              historyRate >= 90 ? 'text-present' : historyRate >= 75 ? 'text-late' : 'text-absent',
            )}
          >
            {historyRate}%
          </span>
        </span>
      </div>

      {/* 累计出勤分布：堆叠条 + 图例 */}
      <div>
        <h3 className="mb-2 text-xs text-muted-foreground">累计出勤分布</h3>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {STATUS_ORDER.map((key) => {
            const n = distribution.counts[key] ?? 0
            if (n === 0) return null
            return (
              <div
                key={key}
                className={cn(STATUS_META[key].bgClass, 'h-full transition-all duration-300')}
                style={{ width: `${(n / distribution.total) * 100}%` }}
                title={`${STATUS_META[key].label} ${n} 次`}
              />
            )
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STATUS_ORDER.map((key) => {
            const meta = STATUS_META[key]
            const n = distribution.counts[key] ?? 0
            return (
              <div key={key} className="rounded-md border border-border bg-background p-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className={cn('inline-block h-2 w-2 rounded-sm', meta.bgClass)}
                    aria-hidden="true"
                  />
                  {meta.label}
                </div>
                <div className={cn('tabular mt-1 text-lg font-semibold', meta.textClass)}>{n}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 被点次数排名：横向柱状图（易比较、带数值标签） */}
      <div>
        <h3 className="mb-3 text-xs text-muted-foreground">被点次数排名（前 10）</h3>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={ranking}
              layout="vertical"
              margin={{ top: 0, right: 32, bottom: 0, left: 0 }}
              barCategoryGap="28%"
            >
              <CartesianGrid horizontal={false} stroke={AXIS_COLOR} strokeOpacity={0.2} />
              <XAxis
                type="number"
                allowDecimals={false}
                stroke={AXIS_COLOR}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke={AXIS_COLOR}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Bar dataKey="count" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                {ranking.map((entry) => (
                  <Cell
                    key={entry.name}
                    /* 次数最多者高亮为强调色，其余保持中性蓝 */
                    fill={entry.count === maxCount && maxCount > 0 ? '#22C55E' : BAR_COLOR}
                  />
                ))}
                <LabelList
                  dataKey="count"
                  position="right"
                  fill={AXIS_COLOR}
                  fontSize={11}
                  className="tabular"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 数据表格替代：保证图表信息可无障碍获取 */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground">
          查看完整点名次数数据
        </summary>
        <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border">
          <table className="w-full">
            <caption className="sr-only">各学生累计被点次数</caption>
            <thead className="sticky top-0 bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-1.5 text-left font-medium">
                  姓名
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  次数
                </th>
              </tr>
            </thead>
            <tbody>
              {fullRanking.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-1.5">{s.name}</td>
                  <td className="tabular px-3 py-1.5 text-right">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
