import confetti from 'canvas-confetti'

/**
 * 揭晓礼花 —— 参数沿用 log-lottery 的 confettiFire：
 * 两侧持续喷射 + 中心多档扩散，比单次 confetti() 更有"中了"的层次感。
 */

/** 同时喷射的结果卡片数量上限，防止抽 10 人时粒子数爆炸导致掉帧 */
const FIRE_MAX_COUNT = 6

function centerFire(particleRatio: number, opts: confetti.Options) {
  confetti({
    origin: { y: 0.7 },
    ...opts,
    particleCount: Math.floor(200 * particleRatio),
  })
}

export function fireConfetti(index: number) {
  if (index >= FIRE_MAX_COUNT) return
  // 尊重系统减弱动效偏好：不做任何喷射
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const duration = 3 * 1000
  const end = Date.now() + duration

  const frame = () => {
    // 左边缘
    confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 } })
    // 右边缘
    confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 } })
    if (Date.now() < end) window.requestAnimationFrame(frame)
  }
  window.requestAnimationFrame(frame)

  centerFire(0.25, { spread: 26, startVelocity: 55 })
  centerFire(0.2, { spread: 60 })
  centerFire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 })
  centerFire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
  centerFire(0.1, { spread: 120, startVelocity: 45 })
}
