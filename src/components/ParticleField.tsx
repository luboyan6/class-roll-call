import { useEffect, useRef } from 'react'

/**
 * 全屏星空粒子背景。
 *
 * 设计要点：
 * - Canvas 2D 绘制，不引入任何三维库，首屏零额外依赖；
 * - 设备像素比上限 2，避免高分屏下粒子数量翻倍拖垮帧率；
 * - 粒子数量按可视面积计算并封顶，窄屏自动减少；
 * - prefers-reduced-motion 时只绘制一帧静态星空，不做任何动画；
 * - 页面不可见时暂停 rAF，回到前台再恢复，笔记本电池友好。
 */

interface Particle {
  x: number
  y: number
  r: number
  /** 漂移速度（像素/帧） */
  vx: number
  vy: number
  /** 闪烁相位 */
  phase: number
  /** 闪烁频率 */
  freq: number
  /** 景深：0 远 → 1 近，影响亮度与尺寸 */
  depth: number
  hue: number
  /** 自转角与角速度，四角星会缓慢转动 */
  rot: number
  spin: number
  /** true 为四角星，false 为圆点 */
  star: boolean
}

interface Meteor {
  x: number
  y: number
  len: number
  speed: number
  life: number
  maxLife: number
}

const MAX_PARTICLES = 150
const MIN_PARTICLES = 36
const DENSITY = 0.00013

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduceMotion = media.matches

    let width = 0
    let height = 0
    let dpr = 1
    let particles: Particle[] = []
    let meteors: Meteor[] = []
    let meteorCooldown = 90
    let raf = 0
    let running = true

    const spawnParticle = (): Particle => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.5 + Math.random() * 1.5,
      vx: (Math.random() - 0.5) * 0.14,
      vy: (Math.random() - 0.5) * 0.14,
      phase: Math.random() * Math.PI * 2,
      freq: 0.008 + Math.random() * 0.022,
      depth: Math.random(),
      hue: Math.random() < 0.22 ? 45 : 195,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.008,
      star: Math.random() < 0.7,
    })

    /** 四角星：长轴为 r，短轴为 r * 0.34，与 sparticles 的 star 形状一致 */
    const drawStar = (x: number, y: number, r: number, rot: number) => {
      ctx.beginPath()
      for (let i = 0; i < 4; i += 1) {
        const a = rot + (i * Math.PI) / 2
        const b = a + Math.PI / 4
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
        ctx.lineTo(x + Math.cos(b) * r * 0.34, y + Math.sin(b) * r * 0.34)
      }
      ctx.closePath()
      ctx.fill()
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const target = Math.round(width * height * DENSITY)
      const count = Math.max(MIN_PARTICLES, Math.min(MAX_PARTICLES, target))
      particles = Array.from({ length: count }, spawnParticle)
      meteors = []
    }

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height)

      for (const p of particles) {
        if (!reduceMotion) {
          p.x += p.vx
          p.y += p.vy
          p.rot += p.spin
          if (p.x < -4) p.x = width + 4
          if (p.x > width + 4) p.x = -4
          if (p.y < -4) p.y = height + 4
          if (p.y > height + 4) p.y = -4
        }

        const twinkle = reduceMotion ? 0.7 : 0.55 + Math.sin(time * p.freq + p.phase) * 0.45
        const alpha = (0.16 + p.depth * 0.5) * twinkle
        const radius = p.r * (0.6 + p.depth * 0.8)

        ctx.fillStyle = `hsla(${p.hue}, 92%, ${68 + p.depth * 18}%, ${alpha.toFixed(3)})`
        if (p.star) {
          drawStar(p.x, p.y, radius * 2.6, p.rot)
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
          ctx.fill()
        }

        // 近处的亮星加一圈柔光，营造纵深
        if (p.depth > 0.78) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, radius * 3.2, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${p.hue}, 95%, 72%, ${(alpha * 0.1).toFixed(3)})`
          ctx.fill()
        }
      }

      if (!reduceMotion) {
        meteorCooldown -= 1
        if (meteorCooldown <= 0) {
          meteorCooldown = 220 + Math.floor(Math.random() * 320)
          meteors.push({
            x: Math.random() * width * 0.7,
            y: Math.random() * height * 0.35,
            len: 90 + Math.random() * 130,
            speed: 5.5 + Math.random() * 4,
            life: 0,
            maxLife: 46 + Math.floor(Math.random() * 26),
          })
        }

        meteors = meteors.filter((m) => {
          m.life += 1
          m.x += m.speed
          m.y += m.speed * 0.42
          const t = m.life / m.maxLife
          if (t >= 1 || m.x > width + m.len) return false

          const fade = Math.sin(t * Math.PI)
          const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.len, m.y - m.len * 0.42)
          grad.addColorStop(0, `hsla(45, 100%, 78%, ${(0.85 * fade).toFixed(3)})`)
          grad.addColorStop(1, 'hsla(45, 100%, 78%, 0)')
          ctx.strokeStyle = grad
          ctx.lineWidth = 1.6
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(m.x, m.y)
          ctx.lineTo(m.x - m.len, m.y - m.len * 0.42)
          ctx.stroke()
          return true
        })
      }
    }

    const loop = (time: number) => {
      if (!running) return
      draw(time)
      raf = window.requestAnimationFrame(loop)
    }

    const start = () => {
      if (raf) return
      running = true
      raf = window.requestAnimationFrame(loop)
    }

    const stop = () => {
      running = false
      if (raf) window.cancelAnimationFrame(raf)
      raf = 0
    }

    const onVisibility = () => {
      if (document.hidden) stop()
      else if (reduceMotion) draw(0)
      else start()
    }

    const onMotionChange = (e: MediaQueryListEvent) => {
      reduceMotion = e.matches
      if (reduceMotion) {
        stop()
        draw(0)
      } else {
        start()
      }
    }

    resize()
    if (reduceMotion) draw(0)
    else start()

    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    media.addEventListener('change', onMotionChange)

    return () => {
      stop()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      media.removeEventListener('change', onMotionChange)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
