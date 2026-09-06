import { AnimatePresence, motion } from 'framer-motion'
import { Check, Clock, FileText, X } from 'lucide-react'
import { useRollCallStore } from '@/store/rollCallStore'
import type { AttendanceStatus, Student } from '@/types'
import { STATUS_META, STATUS_ORDER, cn } from '@/lib/utils'

/**
 * 舞台内的快捷出勤标记。
 *
 * 放在结果正下方而不是页面另一处，是为了让老师的手不用离开视线焦点：
 * 名字刚落定 → 拇指位置就在出勤按钮上，一次点击完成"点名 + 记录"。
 */

const STATUS_ICON: Record<AttendanceStatus, typeof Check> = {
  present: Check,
  late: Clock,
  leave: FileText,
  absent: X,
}

/** 舞台配色下状态色需要更高亮度才能压住深色背景 */
const STATUS_HEX: Record<AttendanceStatus, string> = {
  present: '#34D97B',
  late: '#FBBF24',
  leave: '#60A5FA',
  absent: '#F87171',
}

function MarkButtons({ student, compact }: { student: Student; compact: boolean }) {
  const markStatus = useRollCallStore((s) => s.markStatus)

  return (
    <div className={cn('flex items-center gap-1.5', compact ? '' : 'gap-2')}>
      {STATUS_ORDER.map((key) => {
        const meta = STATUS_META[key]
        const Icon = STATUS_ICON[key]
        const hex = STATUS_HEX[key]
        return (
          <button
            key={key}
            type="button"
            onClick={() => markStatus(student.id, key)}
            title={`${student.name} · ${meta.label}`}
            aria-label={`${student.name} ${meta.label}`}
            className={cn(
              'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold focus-visible:ring-offset-2 focus-visible:ring-offset-stage-bg',
              compact ? 'px-2.5 py-1.5 text-xs' : 'px-5 py-2.5 text-sm font-medium',
            )}
            style={{
              borderColor: `${hex}59`,
              backgroundColor: `${hex}1A`,
              color: hex,
            }}
          >
            <Icon className={cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} aria-hidden="true" />
            <span>{meta.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ResultMarkBar({ picks }: { picks: Student[] }) {
  const clearPicks = useRollCallStore((s) => s.clearPicks)

  return (
    <AnimatePresence>
      {picks.length > 0 && (
        <motion.div
          key="mark-bar"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="w-full max-w-3xl"
        >
          {picks.length === 1 ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs tracking-wide text-stage-dim">标记出勤</p>
              <MarkButtons student={picks[0]} compact={false} />
              <button
                type="button"
                onClick={clearPicks}
                className="cursor-pointer text-xs text-stage-dim underline-offset-4 transition-colors duration-200 hover:text-stage-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold"
              >
                暂不记录
              </button>
            </div>
          ) : (
            <div className="stage-glass rounded-xl p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-xs tracking-wide text-stage-dim">逐个标记出勤</p>
                <span className="tabular text-xs text-stage-dim">待标记 {picks.length} 人</span>
              </div>

              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {picks.map((s) => (
                    <motion.li
                      key={s.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 16, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stage-line bg-stage-deep/60 px-3 py-2"
                    >
                      <span className="text-sm font-semibold text-stage-text">{s.name}</span>
                      <MarkButtons student={s} compact />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>

              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={clearPicks}
                  className="cursor-pointer text-xs text-stage-dim underline-offset-4 transition-colors duration-200 hover:text-stage-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold"
                >
                  全部暂不记录
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
