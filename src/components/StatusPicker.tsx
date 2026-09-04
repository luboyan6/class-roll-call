import { AnimatePresence, motion } from 'framer-motion'
import { Check, Clock, FileText, X } from 'lucide-react'
import { useRollCallStore } from '@/store/rollCallStore'
import type { AttendanceStatus, Student } from '@/types'
import { STATUS_META, STATUS_ORDER, cn } from '@/lib/utils'
import { Button } from './ui/Button'

/** 状态 → 图标（无 emoji，统一 lucide SVG） */
const STATUS_ICON: Record<AttendanceStatus, typeof Check> = {
  present: Check,
  late: Clock,
  leave: FileText,
  absent: X,
}

/**单人：四张大按钮，操作面积大、误触少 */
function SinglePicker({ student }: { student: Student }) {
  const markStatus = useRollCallStore((s) => s.markStatus)
  const clearPicks = useRollCallStore((s) => s.clearPicks)

  return (
    <>
      <h2 className="mb-4 text-center text-sm text-muted-foreground">
        标记 <span className="font-semibold text-foreground">{student.name}</span> 的出勤状态
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_ORDER.map((key) => {
          const meta = STATUS_META[key]
          const Icon = STATUS_ICON[key]
          return (
            <button
              key={key}
              type="button"
              onClick={() => markStatus(student.id, key)}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-2 rounded-md border border-border bg-card px-4 py-4',
                'transition-colors duration-200 hover:bg-muted',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              )}
            >
              <Icon className={cn('h-5 w-5', meta.textClass)} aria-hidden="true" />
              <span className={cn('text-sm font-medium', meta.textClass)}>{meta.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex justify-center">
        <Button variant="ghost" size="sm" onClick={clearPicks} className="text-muted-foreground">
          暂不记录
        </Button>
      </div>
    </>
  )
}

/** 多人：逐人一行，标记完自动出列，避免"点了一堆记不清谁记过" */
function MultiPicker({ students }: { students: Student[] }) {
  const markStatus = useRollCallStore((s) => s.markStatus)
  const dismissPick = useRollCallStore((s) => s.dismissPick)
  const clearPicks = useRollCallStore((s) => s.clearPicks)

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm text-muted-foreground">
          逐个标记出勤状态
        </h2>
        <span className="text-xs text-muted-foreground">待标记 {students.length} 人</span>
      </div>

      <ul className="space-y-2.5">
        <AnimatePresence initial={false}>
          {students.map((s, idx) => (
            <motion.li
              key={s.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 12, height: 0, marginTop: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden rounded-md border border-border bg-background p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="tabular text-xs text-muted-foreground">学号 {s.no}</span>
                  {s.name}
                </span>

                <div className="grid grid-cols-2 gap-1.5 sm:flex sm:gap-2">
                  {STATUS_ORDER.map((key) => {
                    const meta = STATUS_META[key]
                    const Icon = STATUS_ICON[key]
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => markStatus(s.id, key)}
                        title={`${s.name} · ${meta.label}`}
                        className={cn(
                          'inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5',
                          'transition-colors duration-200 hover:bg-muted',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        )}
                      >
                        <Icon
                          className={cn('h-3.5 w-3.5 shrink-0', meta.textClass)}
                          aria-hidden="true"
                        />
                        <span className={cn('text-xs font-medium', meta.textClass)}>
                          {meta.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismissPick(s.id)}
                className="mt-2 cursor-pointer text-xs text-muted-foreground underline-offset-2 transition-colors duration-200 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                跳过（不记录）
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="mt-4 flex justify-center">
        <Button variant="ghost" size="sm" onClick={clearPicks} className="text-muted-foreground">
          全部暂不记录
        </Button>
      </div>
    </>
  )
}

export function StatusPicker() {
  const currentPicks = useRollCallStore((s) => s.currentPicks)

  return (
    <AnimatePresence>
      {currentPicks.length > 0 && (
        <motion.section
          key="status-picker"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          aria-label="标记出勤状态"
          className="rounded-lg border border-border bg-card p-5"
        >
          {currentPicks.length === 1 ? (
            <SinglePicker student={currentPicks[0]} />
          ) : (
            <MultiPicker students={currentPicks} />
          )}
        </motion.section>
      )}
    </AnimatePresence>
  )
}
