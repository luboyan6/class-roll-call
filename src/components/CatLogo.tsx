/**
 * 小猫头像：系统主图标。
 *
 * 纯 SVG 手绘，不依赖任何图标库 —— 需要同时用作 favicon、页头标识和空状态插画，
 * 单色 + 少量点缀色的画法能保证在 16px（标签页）到 96px（空状态）之间都清晰可辨。
 */

interface CatLogoProps {
  className?: string
  /** 无障碍描述，装饰性场景传 null 并自行 aria-hidden */
  title?: string | null
}

export function CatLogo({ className, title = '小猫' }: CatLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      {/* 耳朵 */}
      <path d="M12.6 26.2 8.4 5.6 27.8 14.8Z" fill="currentColor" />
      <path d="M51.4 26.2 55.6 5.6 36.2 14.8Z" fill="currentColor" />
      {/* 内耳 */}
      <path d="M15.4 23.6 12.9 12.4 23.9 17.6Z" fill="#FF9F1C" opacity="0.62" />
      <path d="M48.6 23.6 51.1 12.4 40.1 17.6Z" fill="#FF9F1C" opacity="0.62" />

      {/* 头部 */}
      <ellipse cx="32" cy="37" rx="22.5" ry="19.5" fill="currentColor" />

      {/* 眼睛 */}
      <ellipse cx="23.5" cy="34.5" rx="3.1" ry="4.2" fill="#241A33" />
      <ellipse cx="40.5" cy="34.5" rx="3.1" ry="4.2" fill="#241A33" />
      <circle cx="24.7" cy="32.9" r="1.15" fill="#FFFFFF" opacity="0.92" />
      <circle cx="41.7" cy="32.9" r="1.15" fill="#FFFFFF" opacity="0.92" />

      {/* 鼻子 */}
      <path d="M32 42.2 29.2 39.1h5.6Z" fill="#FF9F1C" />
      {/* 嘴 */}
      <path
        d="M32 42.2v1.9M32 44.1c-1.5 2.3-4 2.1-5.4.3M32 44.1c1.5 2.3 4 2.1 5.4.3"
        stroke="#241A33"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />

      {/* 胡须 */}
      <g stroke="#241A33" strokeWidth="1.15" strokeLinecap="round" opacity="0.75">
        <path d="M14.2 36.4 6.8 34.4" />
        <path d="M14.6 40.2 7.6 40.8" />
        <path d="M49.8 36.4 57.2 34.4" />
        <path d="M49.4 40.2 56.4 40.8" />
      </g>
    </svg>
  )
}
