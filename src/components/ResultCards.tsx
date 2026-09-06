import { motion } from 'framer-motion'
import { CatLogo } from './CatLogo'
import type { Student } from '@/types'
import { cn } from '@/lib/utils'

/**
 * 揭晓结果卡片 —— 对应 log-lottery 的 lucky-element-card：
 * 被抽中的卡片从球面飞到镜头正前方，放大并高亮成金色。
 *
 * 排布规则沿用参考站的 cardRule 思路（按人数决定单行人数与缩放），
 * 但 5 人改为「上 3 下 2」：一行 5 个在课堂投影上字号会被压到看不清。
 */

interface ResultCardsProps {
  students: Student[]
}

/** 人数 → 卡片与字号档位 */
function layoutOf(count: number) {
  if (count === 1) {
    return {
      card: 'h-[190px] w-[min(86vw,400px)] sm:h-[220px]',
      name: 'text-6xl sm:text-7xl',
      icon: 'h-6 w-6',
      gap: 'gap-0',
    }
  }
  if (count <= 3) {
    return {
      card: 'h-[120px] w-[calc((100%-1.5rem)/3)] max-w-[190px] sm:h-[140px]',
      name: 'text-2xl sm:text-4xl',
      icon: 'h-4 w-4',
      gap: 'gap-3',
    }
  }
  return {
    card: 'h-[104px] w-[calc((100%-1.5rem)/3)] max-w-[165px] sm:h-[122px] sm:w-[calc((100%-2rem)/3)]',
    name: 'text-xl sm:text-3xl',
    icon: 'h-3.5 w-3.5',
    gap: 'gap-3 sm:gap-4',
  }
}

export function ResultCards({ students }: ResultCardsProps) {
  const layout = layoutOf(students.length)

  return (
    <div className={cn('flex w-full flex-wrap items-center justify-center', layout.gap)}>
      {students.map((s, i) => (
        <motion.div
          key={s.id}
          initial={{ opacity: 0, scale: 0.7, filter: 'blur(14px)', y: 18 }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ delay: i * 0.11, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl',
            'border border-stage-gold/60 bg-gradient-to-b from-stage-gold/[0.16] to-stage-gold/[0.04]',
            'shadow-[0_0_38px_rgba(247,206,104,0.28)] backdrop-blur-sm',
            layout.card,
          )}
        >
          {/* 顶部高光条，模拟参考站 lucky 卡片的渐变边 */}
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-stage-gold/80 to-transparent"
            aria-hidden="true"
          />

          <CatLogo className={cn('shrink-0 text-stage-gold/85', layout.icon)} title={null} />

          <span
            className={cn(
              'max-w-full truncate px-2 text-center font-display font-black leading-none tracking-wide',
              'text-gold-gradient name-glow',
              layout.name,
            )}
          >
            {s.name}
          </span>
        </motion.div>
      ))}
    </div>
  )
}
