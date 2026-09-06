import { CatLogo } from './CatLogo'
import { formatChineseDate, formatWeekday } from '@/lib/utils'

/**
 * 舞台标题：绝对定位在顶部居中，不占布局高度，球体可以铺满整个视口。
 * 入场动画沿用 log-lottery 的 tracking-in-expand-fwd（字距拉开 + 由远及近）。
 */
export function StageTitle() {
  const now = new Date()

  return (
    <div className="pointer-events-none absolute left-1/2 top-0 z-20 flex -translate-x-1/2 flex-col items-center">
      <div className="flex items-center gap-3 pt-8 sm:pt-10">
        <CatLogo className="h-8 w-8 text-stage-gold sm:h-10 sm:w-10" />
        <h1
          className="animate-tracking-in bg-gradient-to-r from-stage-gold via-amber-200 to-stage-neon bg-clip-text text-2xl font-black tracking-wide text-transparent sm:text-4xl lg:text-5xl"
          style={{ textShadow: '0 0 34px rgba(247, 206, 104, 0.35)' }}
        >
          图图课堂点名系统
        </h1>
      </div>

      <p className="mt-2 text-xs tracking-widest text-stage-dim sm:text-sm">
        {formatChineseDate(now)} · {formatWeekday(now)}
      </p>
    </div>
  )
}
