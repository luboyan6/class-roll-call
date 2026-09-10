import { Plus, School } from 'lucide-react'
import { useRollCallStore } from '@/store/rollCallStore'
import { cn } from '@/lib/utils'

/**
 * 首屏班级切换条。
 *
 * 放在标题下方的首屏可见区，老师一进页面就能换班，不用滚到底部去翻设置。
 * 班级数量不设上限，超出宽度时横向滚动，绝不换行把舞台挤塌。
 */
export function ClassSwitcher() {
  const classes = useRollCallStore((s) => s.classes)
  const activeClassId = useRollCallStore((s) => s.activeClassId)
  const setActiveClass = useRollCallStore((s) => s.setActiveClass)
  const isRolling = useRollCallStore((s) => s.isRolling)

  // 只有一个班时切换条没有意义，直接不渲染，把首屏空间留给点名
  if (classes.length <= 1) return null

  return (
    <nav
      aria-label="班级切换"
      className="mb-3 flex w-full max-w-3xl items-center justify-center gap-2 sm:mb-4"
    >
      <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {classes.map((c) => {
          const active = c.id === activeClassId
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveClass(c.id)}
              disabled={isRolling}
              aria-current={active ? 'true' : undefined}
              title={`切换到 ${c.name} 班（${c.students.length} 人）`}
              className={cn(
                'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold focus-visible:ring-offset-2 focus-visible:ring-offset-stage-bg',
                'disabled:cursor-not-allowed disabled:opacity-50',
                active
                  ? 'border-stage-gold/70 bg-stage-gold/15 text-stage-gold shadow-[0_0_16px_rgba(247,206,104,0.22)]'
                  : 'border-stage-line bg-stage-panel text-stage-dim hover:border-stage-neon/40 hover:text-stage-text',
              )}
            >
              <School className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="whitespace-nowrap">{c.name} 班</span>
              <span
                className={cn(
                  'tabular text-[10px]',
                  active ? 'text-stage-gold/80' : 'text-stage-dim/70',
                )}
              >
                {c.students.length}
              </span>
            </button>
          )
        })}

        {/* 新建班级入口：滚动到底部的班级管理区并聚焦名称输入框 */}
        <a
          href="#class-manager"
          title="新建或管理班级"
          aria-label="新建或管理班级"
          className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-stage-line text-stage-dim transition-colors duration-200 hover:border-stage-gold/60 hover:text-stage-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold focus-visible:ring-offset-2 focus-visible:ring-offset-stage-bg"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </nav>
  )
}
