import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * 舞台主按钮 —— 沿用 log-lottery 的 OptionsButton 样式与状态分工：
 *
 *  进入点名（init）     → neon   霓虹辉光，吸引第一次点击
 *  开始点名（ready）    → stars  渐变流光描边 + 内部星空 + 底部光晕 + 呼吸缩放，主操作
 *  停止并揭晓（running）→ neon   紧急感
 *  继续 / 返回（end）   → stars + cancel
 *
 * 参考站按钮是纯 CSS 实现（#container-stars / #glow 两层装饰 + keyframes），
 * 这里保持同样的 DOM 结构，样式全部放在 index.css 里，React 只负责拼装。
 */

type NeonVariant = 'stars' | 'cancel' | 'neon'

interface NeonButtonProps {
  variant?: NeonVariant
  onClick: () => void
  disabled?: boolean
  children: ReactNode
  className?: string
  ariaLabel?: string
  title?: string
}

export function NeonButton({
  variant = 'stars',
  onClick,
  disabled,
  children,
  className,
  ariaLabel,
  title,
}: NeonButtonProps) {
  if (variant === 'neon') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        title={title}
        className={cn('btn-neon', className)}
      >
        {children}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      className={cn('btn-stars', variant === 'cancel' && 'btn-stars--cancel', className)}
    >
      <strong>{children}</strong>
      <span className="btn-stars__stars" aria-hidden="true" />
      <span className="btn-stars__glow" aria-hidden="true">
        <span className="circle" />
        <span className="circle" />
      </span>
    </button>
  )
}
