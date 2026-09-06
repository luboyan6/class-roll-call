import { useEffect, useMemo, useRef } from 'react'
import type { Student } from '@/types'
import { cn } from '@/lib/utils'

/**
 * 3D 姓名球 —— 复刻 log-lottery 的核心舞台特效。
 *
 * 球面坐标沿用 log-lottery 的斐波那契球面公式（src/views/Home/utils/table.ts）：
 *   phi   = acos(-1 + 2i / N)
 *   theta = sqrt(N * PI) * phi
 * 这套参数在几十到上千个点上都能保持均匀分布，不会出现两极堆积。
 *
 * 为什么不用 three.js + CSS3DRenderer：
 * - 参考站用它，本质只是给每个 DOM 节点写 matrix3d，纯 CSS 3D 完全等价；
 * - 引入 three 会让首屏 JS 从 ~330KB 涨到 ~800KB，而课堂网络/投影电脑往往最差；
 * - CSS3DRenderer 需要手动 createElement + appendChild，与 React 的声明式渲染互相打架。
 *
 * 抽奖"跳动感"来自 randomBallData：滚动期间每隔一段时间随机替换若干张卡片上的名字，
 * 这是原站制造悬念的关键，比单纯加快转速有效得多。
 */

export type SpherePhase = 'idle' | 'ready' | 'rolling' | 'revealed'

interface NameSphereProps {
  students: Student[]
  /** idle 慢转 / ready 中速 / rolling 高速 + 名字跳动 / revealed 缩小让位给结果 */
  phase: SpherePhase
  /** 揭晓结果：这些卡片高亮成金色 */
  highlightIds?: string[]
  /** 今日已点名的学生，卡片显示为已处理 */
  calledIds?: Set<string>
  /** 球面半径（px） */
  radius?: number
  className?: string
}

const IDLE_SPEED = 0.0015
const READY_SPEED = 0.0075
const ROLL_SPEED = 0.03
const ENTER_MS = 1200
/** 滚动时每隔多久替换一批卡片名字 */
const SWAP_INTERVAL_MS = 130
/** 每批替换多少张 */
const SWAP_COUNT = 6

interface SpherePoint {
  id: string
  name: string
  /** 球面坐标（单位向量，渲染时乘以 radius） */
  ux: number
  uy: number
  uz: number
  /** 入场动画的起点（三维随机位置），用于飞散聚合效果 */
  fx: number
  fy: number
  fz: number
}

/** 斐波那契球面分布 + 随机入场起点 */
function buildSpherePoints(students: Student[]): SpherePoint[] {
  const n = students.length
  if (n === 0) return []

  const golden = Math.sqrt(n * Math.PI)
  return students.map((s, i) => {
    const phi = Math.acos(-1 + (2 * i) / n)
    const theta = golden * phi
    const sinPhi = Math.sin(phi)
    return {
      id: s.id,
      name: s.name,
      ux: Math.cos(theta) * sinPhi,
      uy: Math.sin(theta) * sinPhi,
      uz: -Math.cos(phi),
      // 入场：从更远处随机位置聚合，形成"卡片从四面八方飞来"的开场
      fx: (Math.random() - 0.5) * 4.2,
      fy: (Math.random() - 0.5) * 4.2,
      fz: (Math.random() - 0.5) * 4.2,
    }
  })
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * 各阶段的球体视觉：滚动时缩小并压暗，把视觉焦点让给中央大字；
 * 揭晓后进一步缩小，作为结果卡片的氛围背景 —— 与参考站"卡片飞到镜头前"的层次一致。
 */
const SPHERE_VISUAL: Record<SpherePhase, { scale: number; opacity: number }> = {
  idle: { scale: 1, opacity: 1 },
  ready: { scale: 0.95, opacity: 0.9 },
  rolling: { scale: 0.72, opacity: 0.5 },
  revealed: { scale: 0.58, opacity: 0.32 },
}

export function NameSphere({
  students,
  phase,
  highlightIds = [],
  calledIds,
  radius = 215,
  className,
}: NameSphereProps) {
  const nodeRefs = useRef(new Map<string, HTMLSpanElement>())
  const nameRefs = useRef(new Map<string, HTMLElement>())
  /** 高亮集合放进 ref：rAF 每帧读取最新值，避免动画循环因 props 变化被反复重启 */
  const hiRef = useRef({ highlight: new Set<string>(), called: calledIds, phase, names: [] as string[] })
  hiRef.current = {
    highlight: new Set(highlightIds),
    called: calledIds,
    phase,
    names: students.map((s) => s.name),
  }

  const points = useMemo(() => buildSpherePoints(students), [students])

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let rotY = 0
    let raf = 0
    let lastSwap = 0

    const render = (now: number) => {
      const enter = reduceMotion ? 1 : easeOutCubic(Math.min((now - start) / ENTER_MS, 1))
      const { highlight, called, names } = hiRef.current
      const currentPhase = hiRef.current.phase

      // 名字跳动：滚动期间定期随机替换若干张卡片上的文字
      if (currentPhase === 'rolling' && !reduceMotion && now - lastSwap > SWAP_INTERVAL_MS) {
        lastSwap = now
        for (let k = 0; k < SWAP_COUNT; k += 1) {
          const p = points[Math.floor(Math.random() * points.length)]
          if (!p || highlight.has(p.id)) continue
          const el = nameRefs.current.get(p.id)
          if (el && names.length > 0) {
            el.textContent = names[Math.floor(Math.random() * names.length)]
          }
        }
      }

      for (const p of points) {
        const el = nodeRefs.current.get(p.id)
        if (!el) continue

        // 入场期间在"随机起点"和"球面位置"之间插值
        const bx = p.fx + (p.ux - p.fx) * enter
        const by = p.fy + (p.uy - p.fy) * enter
        const bz = p.fz + (p.uz - p.fz) * enter

        // 绕 Y 轴自转
        const x = bx * Math.cos(rotY) + bz * Math.sin(rotY)
        const z = -bx * Math.sin(rotY) + bz * Math.cos(rotY)
        const y = by

        // 单位向量长度用于计算俯仰角，入场插值时长度会变化，需要归一化
        const len = Math.hypot(x, y, z) || 1
        const ry = Math.atan2(x, z)
        const rx = -Math.asin(Math.max(-1, Math.min(1, y / len)))

        // 深度：0 最远，1 最近
        const depth = (z + 1) / 2
        const isHi = highlight.has(p.id)
        const isCalled = called?.has(p.id) ?? false

        const scale = (0.62 + depth * 0.55) * (isHi ? 1.25 : 1)
        const opacity = isHi
          ? Math.max(0.75, 0.35 + depth * 0.65)
          : isCalled
            ? 0.18 + depth * 0.4
            : 0.22 + depth * 0.78

        const px = x * radius
        // CSS 的 y 轴向下，故取反
        const py = -y * radius
        const pz = z * radius

        el.style.transform = `translate3d(-50%, -50%, 0) translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, ${pz.toFixed(1)}px) rotateY(${ry.toFixed(3)}rad) rotateX(${rx.toFixed(3)}rad) scale(${scale.toFixed(3)})`
        el.style.opacity = opacity.toFixed(3)
        el.style.zIndex = String(Math.round(depth * 1000))
      }
    }

    if (reduceMotion) {
      render(performance.now())
      return
    }

    const loop = (now: number) => {
      rotY +=
        phase === 'rolling'
          ? ROLL_SPEED
          : phase === 'ready'
            ? READY_SPEED
            : IDLE_SPEED
      render(now)
      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)

    return () => window.cancelAnimationFrame(raf)
  }, [points, radius, phase])

  /** 退出滚动态后把被替换过的名字改回真实姓名 */
  useEffect(() => {
    if (phase === 'rolling') return
    for (const p of points) {
      const el = nameRefs.current.get(p.id)
      if (el && el.textContent !== p.name) el.textContent = p.name
    }
  }, [phase, points])

  const highlightSet = useMemo(() => new Set(highlightIds), [highlightIds])

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 transition-all duration-700 ease-out', className)}
      style={{
        transform: `scale(${SPHERE_VISUAL[phase].scale})`,
        opacity: SPHERE_VISUAL[phase].opacity,
      }}
      aria-hidden="true"
    >
      <div className="preserve-3d absolute inset-0" style={{ perspective: '1000px' }}>
        <div className="preserve-3d absolute left-1/2 top-1/2 h-0 w-0">
          {points.map((p) => {
            const isHi = highlightSet.has(p.id)
            const isCalled = calledIds?.has(p.id) ?? false
            return (
              <span
                key={p.id}
                ref={(el) => {
                  if (el) nodeRefs.current.set(p.id, el)
                  else nodeRefs.current.delete(p.id)
                }}
                className={cn(
                  'absolute left-0 top-0 flex h-[34px] w-[60px] items-center justify-center overflow-hidden rounded-md text-[13px] font-semibold tracking-wide transition-colors duration-300 sm:h-[38px] sm:w-[68px] sm:text-[14px]',
                  isHi
                    ? 'border border-stage-gold/80 bg-stage-gold/20 text-stage-gold shadow-[0_0_22px_rgba(247,206,104,0.5)]'
                    : isCalled
                      ? 'border border-present/40 bg-present/10 text-present/90'
                      : 'border border-stage-line bg-stage-panel text-stage-text/90',
                )}
                style={{ willChange: 'transform, opacity' }}
              >
                <span
                  ref={(el) => {
                    if (el) nameRefs.current.set(p.id, el)
                    else nameRefs.current.delete(p.id)
                  }}
                  className="truncate px-1"
                >
                  {p.name}
                </span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
