import { CatLogo } from './CatLogo'
import { formatChineseDate, formatWeekday } from '@/lib/utils'

/**
 * 舞台标题：绝对定位在首屏顶部，不占布局高度，球体可以铺满整个视口。
 * 左：小猫图标 + 系统名称；右：日期与星期（与参考站的"标题居中"不同，
 * 这里把两侧信息分开，中间完全留给球体）。
 * 入场动画沿用 log-lottery 的 tracking-in-expand-fwd（字距拉开 + 由远及近）。
 */
export function StageTitle() {
  const now = new Date()

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-4 pt-3 sm:px-6 sm:pt-4 lg:pt-5">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
        <CatLogo className="h-6 w-6 shrink-0 text-stage-gold sm:h-8 sm:w-8 lg:h-9 lg:w-9" />
        <h1
          className="animate-tracking-in truncate bg-gradient-to-r from-stage-gold via-amber-200 to-stage-neon bg-clip-text text-base font-black tracking-wide text-transparent sm:text-2xl lg:text-3xl"
          style={{ textShadow: '0 0 34px rgba(247, 206, 104, 0.35)' }}
        >
          图图课堂点名系统
        </h1>
      </div>

      <div className="flex shrink-0 flex-col items-end pt-0">
        <span className="text-[10px] tracking-wider text-stage-dim sm:text-xs lg:text-sm">
          {formatChineseDate(now)}
        </span>
        <span className="mt-0.5 text-[9px] tracking-widest text-stage-dim/70 sm:text-[11px]">
          {formatWeekday(now)}
        </span>
      </div>
    </div>
  )
}
