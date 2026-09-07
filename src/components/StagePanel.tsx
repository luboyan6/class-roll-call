import { useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, History, Target, Users } from 'lucide-react'
import { useRollCallStore } from '@/store/rollCallStore'
import { CatLogo } from './CatLogo'
import { STATUS_META, cn, todayKey } from '@/lib/utils'

/**
 * 舞台左侧信息面板 —— 对应 log-lottery 的 PrizeList。
 *
 * 课堂场景不需要"奖项"，但同样需要一个常驻的状态看板：老师点名时要能随时看到
 * 今天点过多少人、还剩多少、最近点了谁，所以沿用参考站的卡片形态与折叠交互。
 */

function PanelCard({
  icon,
  title,
  value,
  progress,
  active,
}: {
  icon: ReactNode
  title: string
  value: string
  progress?: number
  active?: boolean
}) {
  return (
    <li>
      <div
        className={cn(
          'relative flex h-[68px] w-56 flex-row items-center gap-3 rounded-xl px-3',
          'border bg-stage-deep/70 shadow-xl backdrop-blur-sm transition-colors duration-200',
          active ? 'border-stage-gold/60' : 'border-stage-line',
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stage-panel">
          {icon}
        </span>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="truncate text-sm font-semibold text-stage-text">{title}</span>
          {progress === undefined ? null : (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-stage-amber to-stage-gold transition-[width] duration-500"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
        </div>

        <span className="tabular shrink-0 text-xs text-stage-dim">{value}</span>
      </div>
    </li>
  )
}

export function StagePanel() {
  const students = useRollCallStore((s) => s.students)
  const records = useRollCallStore((s) => s.records)
  const mode = useRollCallStore((s) => s.mode)
  const [open, setOpen] = useState(true)

  const todayRecords = useMemo(() => {
    const d = todayKey()
    return records.filter((r) => r.date === d)
  }, [records])

  const calledCount = useMemo(
    () => new Set(todayRecords.map((r) => r.studentId)).size,
    [todayRecords],
  )

  const recent = useMemo(() => todayRecords.slice(-3).reverse(), [todayRecords])

  const modeLabel =
    mode === 'weighted' ? '加权随机' : mode === 'random' ? '纯随机' : '顺序轮询'

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="展开课堂状态"
        aria-label="展开课堂状态"
        className="absolute left-0 top-32 z-30 hidden h-10 w-6 cursor-pointer items-center justify-center rounded-r-lg bg-slate-500/40 text-stage-text transition-colors duration-200 hover:bg-slate-500/70 hover:text-stage-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold lg:flex"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="absolute left-0 top-32 z-30 hidden lg:block">
      <div className="flex items-start">
        <ul className="flex flex-col gap-2 rounded-xl bg-slate-500/30 p-2">
          <PanelCard
            icon={<Target className="h-5 w-5 text-stage-gold" aria-hidden="true" />}
            title="今日点名"
            value={`${calledCount}/${students.length}`}
            progress={students.length ? calledCount / students.length : 0}
            active
          />

          <PanelCard
            icon={<Users className="h-5 w-5 text-stage-neon" aria-hidden="true" />}
            title={modeLabel}
            value={`${students.length} 人`}
          />

          <li>
            <div className="relative flex min-h-[68px] w-56 flex-row items-center gap-3 rounded-xl border border-stage-line bg-stage-deep/70 px-3 py-2 shadow-xl backdrop-blur-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stage-panel">
                <History className="h-5 w-5 text-stage-violet" aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs text-stage-dim">最近点名</span>
                {recent.length === 0 ? (
                  <span className="mt-1 text-xs text-stage-dim/70">今天还没有记录</span>
                ) : (
                  <ul className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                    {recent.map((r) => {
                      const meta = STATUS_META[r.status]
                      return (
                        <li key={r.id} className="flex items-center gap-1 text-xs">
                          <span className="text-stage-text">{r.studentName}</span>
                          <span className={meta.textClass}>({meta.label})</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </li>
        </ul>

        <button
          type="button"
          onClick={() => setOpen(false)}
          title="收起课堂状态"
          aria-label="收起课堂状态"
          className="mt-1 flex h-10 w-6 cursor-pointer items-center justify-center rounded-r-lg bg-slate-500/40 text-stage-text transition-colors duration-200 hover:bg-slate-500/70 hover:text-stage-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 pl-2">
        <CatLogo className="h-5 w-5 text-stage-gold/70" title={null} />
        <span className="text-xs text-stage-dim">随机浏览全班后揭晓</span>
      </div>
    </div>
  )
}
