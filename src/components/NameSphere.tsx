import { useEffect, useMemo, useRef, useState } from 'react'
import type { Student } from '@/types'
import { cn } from '@/lib/utils'

/**
 * 姓名舞台 —— 复刻 log-lottery 的核心特效。
 *
 * 状态机沿用参考站的 LotteryStatus：
 *   init    面板态：所有卡片按网格平铺（createTableVertices）
 *   ready   球态：聚合成球并缓慢自转（createSphereVertices）
 *   rolling 抽取中：球体加速自转 + 卡片名字随机跳动（randomBallData），
 *                  中央不放任何文字，与参考站一致
 *   end     揭晓：抽中的卡片变金、放大并飞向镜头（stopLottery + mod:'lucky'）
 *
 * 球面坐标沿用 log-lottery 的斐波那契球面公式（src/views/Home/utils/table.ts）：
 *   phi   = acos(-1 + 2i / N)
 *   theta = sqrt(N * PI) * phi
 *
 * 人名填充沿用 initTableData 的思路：班级只有 32 人，直接成球会稀稀拉拉，
 * 所以把名单复制若干份铺满球面（约 56 张卡片）。填充只影响视觉，
 * 抽取始终只走原始名单（见 RollCallStage）。
 *
 * 卡片排版对齐参考站：双行 = 顶部小字"学号" + 底部大字"姓名"。
 *
 * 为什么不用 three.js + CSS3DRenderer：
 * - 参考站用它，本质只是给每个 DOM 节点写 matrix3d，纯 CSS 3D 完全等价；
 * - 引入 three 会让首屏 JS 从 ~330KB 涨到 ~800KB，而课堂网络/投影电脑往往最差；
 * - CSS3DRenderer 需要手动 createElement + appendChild，与 React 的声明式渲染互相打架。
 */

export type StageStatus = 'init' | 'ready' | 'rolling' | 'end'

interface NameSphereProps {
  /** 原始班级名单（抽取只用这份） */
  students: Student[]
  status: StageStatus
  /** 揭晓结果：这些学生的卡片高亮成金色（自动挑一张同名卡片，等同 selectCard） */
  highlightIds?: string[]
  /** 今日已点名的学生，卡片显示为已处理 */
  calledIds?: Set<string>
  className?: string
}

/** 面板态卡片尺寸与间距（px） */
const CARD_W = 76
const CARD_H = 52
const GAP_X = 4
const GAP_Y = 4

/**
 * 自转角速度，单位 rad/ms —— 用时间而非帧数计速，高刷屏（120Hz）不会转得更快。
 * 换算：0.009 rad/ms ≈ 8.6 rad/s ≈ 1.4 圈/秒（抽取时的高速旋转）
 */
const SPEED: Record<StageStatus, number> = {
  init: 0,
  ready: 0.00012,
  rolling: 0.011,
  end: 0.00005,
}

/** 加/减速时间常数（ms）：起步要快，停下来要有惯性慢慢收 */
const SPIN_UP_TAU = 260
const SPIN_DOWN_TAU = 700
/** 面板 ↔ 球体的形变时长 */
const MORPH_MS = 1400
/** 首屏卡片飞入聚拢时长 */
const ENTER_MS = 1300
/** 每张卡片的入场延迟，形成波浪式聚拢 */
const ENTER_STAGGER_MS = 4
/** 滚动时每隔多久替换一批卡片名字 */
const SWAP_INTERVAL_MS = 120
/** 每批替换多少张 */
const SWAP_COUNT = 8

const VISUAL: Record<StageStatus, { scale: number; opacity: number }> = {
  init: { scale: 1, opacity: 1 },
  ready: { scale: 1, opacity: 1 },
  rolling: { scale: 1, opacity: 1 },
  end: { scale: 1, opacity: 1 },
}

interface StageMetrics {
  radius: number
  cols: number
  rows: number
  /** 面板态整体缩放，保证网格在小屏也装得下 */
  tableScale: number
}

/**
 * 把"32 人填成球"的密度提到约 100 张卡片，对齐参考站首页 14×7 的网格。
 * 班级只有 32 人，所以每人平均出现 3 次左右（initTableData 的思路），
 * 抽取逻辑始终只从原始 32 人走，球面/面板的重复卡片只是视觉填充。
 */
function readMetrics(): StageMetrics {
  const w = typeof window === 'undefined' ? 1280 : window.innerWidth
  if (w < 400) return { radius: 130, cols: 5, rows: 7, tableScale: 0.6 }
  if (w < 480) return { radius: 150, cols: 6, rows: 6, tableScale: 0.68 }
  if (w < 768) return { radius: 180, cols: 7, rows: 7, tableScale: 0.78 }
  if (w < 1024) return { radius: 215, cols: 9, rows: 7, tableScale: 0.84 }
  if (w < 1280) return { radius: 250, cols: 12, rows: 8, tableScale: 0.82 }
  return { radius: 270, cols: 14, rows: 7, tableScale: 0.78 }
}

/** 球面半径 / 网格规模随视口自适应 */
function useStageMetrics(): StageMetrics {
  const [m, setM] = useState<StageMetrics>(readMetrics)

  useEffect(() => {
    const calc = () =>
      // 数值没变就不更新：避免 resize 触发无意义的重建（会重播入场动画）
      setM((prev) => {
        const next = readMetrics()
        return prev.cols === next.cols && prev.radius === next.radius ? prev : next
      })
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  return m
}

type CardColor = 'pink' | 'rose' | 'blue' | 'magenta' | 'violet'

interface Card {
  key: string
  studentId: string
  name: string
  no: number
  color: CardColor
  /** 面板态坐标（px，相对舞台中心） */
  tx: number
  ty: number
  /** 球面单位向量 */
  ux: number
  uy: number
  uz: number
  /** 入场起点偏移（px），营造"从四面八方飞来聚拢"的开场 */
  ex: number
  ey: number
  ez: number
}

const COLORS: CardColor[] = ['pink', 'rose', 'blue', 'magenta', 'violet']

/** 用学生 id 当种子给每张卡片分一种主色，整体像参考站一样有色彩变化 */
function pickColor(seed: string): CardColor {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0
  }
  return COLORS[h % COLORS.length]
}

/** 学号显示格式：U + 8 位补零，对齐参考站的 U100156007 视觉 */
function formatCode(no: number): string {
  return `U${no.toString().padStart(8, '0')}`
}

function shuffled(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * 构造卡片：先按网格规模确定总数（不足则复制名单填充满），
 * 再同时算出每张卡片的"面板坐标"和"球面坐标"，两种形态之间可以逐帧插值。
 *
 * 复制时打乱顺序再拼接，避免同名卡片在球面上挤成一坨。
 */
function buildCards(students: Student[], m: StageMetrics): Card[] {
  const n = students.length
  if (n === 0) return []

  const total = Math.max(m.cols * m.rows, n)
  const cols = m.cols
  const rows = Math.ceil(total / cols)

  const order: number[] = []
  while (order.length < total) order.push(...shuffled(n))
  order.length = total

  const golden = Math.sqrt(total * Math.PI)
  const cards: Card[] = []

  for (let i = 0; i < total; i += 1) {
    const s = students[order[i]]
    const phi = Math.acos(-1 + (2 * i) / total)
    const theta = golden * phi
    const sinPhi = Math.sin(phi)
    const col = i % cols
    const row = Math.floor(i / cols)

    cards.push({
      key: `${s.id}#${i}`,
      studentId: s.id,
      name: s.name,
      no: s.no,
      color: pickColor(s.id),
      tx: (col - (cols - 1) / 2) * (CARD_W + GAP_X),
      ty: (row - (rows - 1) / 2) * (CARD_H + GAP_Y),
      ux: Math.cos(theta) * sinPhi,
      uy: Math.sin(theta) * sinPhi,
      uz: -Math.cos(phi),
      ex: (Math.random() - 0.5) * 2.4 * m.radius,
      ey: (Math.random() - 0.5) * 2.4 * m.radius,
      ez: (Math.random() - 0.5) * 1.8 * m.radius,
    })
  }

  return cards
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

const COLOR_CLASS: Record<CardColor, string> = {
  pink: 'stage-card--pink',
  rose: 'stage-card--rose',
  blue: 'stage-card--blue',
  magenta: 'stage-card--magenta',
  violet: 'stage-card--violet',
}

export function NameSphere({
  students,
  status,
  highlightIds = [],
  calledIds,
  className,
}: NameSphereProps) {
  const metrics = useStageMetrics()
  const cards = useMemo(() => buildCards(students, metrics), [students, metrics])

  const nodeRefs = useRef<(HTMLSpanElement | null)[]>([])
  const nameRefs = useRef<(HTMLSpanElement | null)[]>([])
  const rotYRef = useRef(0)
  /** 当前角速度（rad/ms），用于加减速的平滑过渡 */
  const speedRef = useRef(0)
  /** 形变进度：0 = 面板，1 = 球体 */
  const morphRef = useRef({ value: 0, from: 0, to: 0, start: 0 })
  const enterRef = useRef({ start: 0 })

  const highlightKey = highlightIds.join(',')
  /** 每位中签学生随机挑一张同名卡片高亮（等价于参考站的 selectCard） */
  const lucky = useMemo(() => {
    const set = new Set<number>()
    if (!highlightKey) return set
    for (const id of highlightKey.split(',')) {
      const candidates: number[] = []
      cards.forEach((c, i) => {
        if (c.studentId === id && !set.has(i)) candidates.push(i)
      })
      if (candidates.length > 0) {
        set.add(candidates[Math.floor(Math.random() * candidates.length)])
      }
    }
    return set
  }, [cards, highlightKey])

  /** 每帧读取的最新数据放进 ref，避免动画循环因 props 变化被反复重启 */
  const dataRef = useRef({
    status,
    lucky,
    called: calledIds,
    names: [] as string[],
    cards,
  })
  dataRef.current = {
    status,
    lucky,
    called: calledIds,
    names: students.map((s) => s.name),
    cards,
  }

  /** 状态切换时启动一次形变补间 */
  useEffect(() => {
    const to = status === 'init' ? 0 : 1
    morphRef.current = {
      value: morphRef.current.value,
      from: morphRef.current.value,
      to,
      start: performance.now(),
    }
  }, [status])

  /** 卡片集合变化（名单/网格规模变化）时重播入场动画 */
  useEffect(() => {
    enterRef.current.start = performance.now()
  }, [cards])

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const { radius, tableScale } = metrics
    let raf = 0
    let lastSwap = 0
    let lastTime = performance.now()

    const render = (now: number) => {
      const { status: st, lucky: luckySet, called, names, cards: cs } = dataRef.current

      const mr = morphRef.current
      const mp = reduceMotion ? 1 : Math.min((now - mr.start) / MORPH_MS, 1)
      mr.value = mr.from + (mr.to - mr.from) * easeInOutCubic(mp)
      const m = mr.value

      // 入场：从随机散落位置聚拢到当前形态
      const enterBase = enterRef.current.start

      // 名字跳动：滚动期间定期随机替换若干张卡片上的文字，制造"高速翻名"感
      if (st === 'rolling' && !reduceMotion && now - lastSwap > SWAP_INTERVAL_MS) {
        lastSwap = now
        for (let k = 0; k < SWAP_COUNT; k += 1) {
          const i = Math.floor(Math.random() * cs.length)
          if (luckySet.has(i)) continue
          const el = nameRefs.current[i]
          if (el && names.length > 0) {
            el.textContent = names[Math.floor(Math.random() * names.length)]
          }
        }
      }

      const rotY = rotYRef.current
      const cos = Math.cos(rotY)
      const sin = Math.sin(rotY)

      for (let i = 0; i < cs.length; i += 1) {
        const el = nodeRefs.current[i]
        if (!el) continue
        const c = cs[i]

        // 球面目标点（绕 Y 轴自转后）
        const sx = c.ux * cos + c.uz * sin
        const sz = -c.ux * sin + c.uz * cos
        const sy = c.uy

        const sphX = sx * radius
        const sphY = -sy * radius
        const sphZ = sz * radius

        // 面板 ↔ 球体插值
        let px = c.tx + (sphX - c.tx) * m
        let py = c.ty + (sphY - c.ty) * m
        const pz = sphZ * m

        // 入场偏移
        const ep = reduceMotion
          ? 1
          : easeOutCubic(clamp((now - enterBase - i * ENTER_STAGGER_MS) / ENTER_MS, 0, 1))
        const inv = 1 - ep
        px += c.ex * inv
        py += c.ey * inv
        const pzz = pz + c.ez * inv

        // 卡片朝向：面板态正对镜头，球态沿法线朝外
        const ry = m * Math.atan2(sx, sz)
        const rx = m * -Math.asin(clamp(sy, -1, 1))

        const depthS = (sz + 1) / 2
        const depth = 0.5 + (depthS - 0.5) * m
        const isLucky = luckySet.has(i)
        const isCalled = called?.has(c.studentId) ?? false

        const sphereScale = (0.6 + depthS * 0.55) * (isLucky ? 1.4 : 1)
        const scale = tableScale * (1 - m) + sphereScale * m

        const sphereOpacity = isLucky ? 1 : isCalled ? 0.32 : 0.45 + depthS * 0.55
        const opacity = 0.96 * (1 - m) + sphereOpacity * m

        // 中签卡片再往前飞一段，靠近镜头
        const zBoost = isLucky ? m * 200 : 0

        el.style.transform = `translate3d(-50%, -50%, 0) translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, ${(pzz + zBoost).toFixed(1)}px) rotateY(${ry.toFixed(3)}rad) rotateX(${rx.toFixed(3)}rad) scale(${scale.toFixed(3)})`
        el.style.opacity = opacity.toFixed(3)
        el.style.zIndex = String(Math.round(depth * 1000) + (isLucky ? 3000 : 0))
      }
    }

    if (reduceMotion) {
      morphRef.current.value = morphRef.current.to
      render(performance.now())
      return
    }

    const loop = (now: number) => {
      const st = dataRef.current.status
      // 时间差驱动：帧率变化时转速保持一致；上限 120ms，避免投影电脑掉帧时"转速被吃掉"，
      // 同时防止从后台标签页切回时因 dt 过大而瞬间跳一大截
      const dt = Math.min(now - lastTime, 120)
      lastTime = now

      // 指数逼近目标转速：起步快、停下慢，模拟飞轮惯性
      const target = SPEED[st]
      const tau = target > speedRef.current ? SPIN_UP_TAU : SPIN_DOWN_TAU
      speedRef.current += (target - speedRef.current) * (1 - Math.exp(-dt / tau))
      rotYRef.current += speedRef.current * dt

      render(now)
      raf = window.requestAnimationFrame(loop)
    }
    lastTime = performance.now()
    raf = window.requestAnimationFrame(loop)

    return () => window.cancelAnimationFrame(raf)
  }, [metrics, status])

  /** 退出滚动态后把被替换过的名字改回真实姓名 */
  useEffect(() => {
    if (status === 'rolling') return
    cards.forEach((c, i) => {
      const el = nameRefs.current[i]
      if (el && el.textContent !== c.name) el.textContent = c.name
    })
  }, [status, cards])

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 transition-all duration-700 ease-out',
        className,
      )}
      style={{
        transform: `scale(${VISUAL[status].scale})`,
        opacity: VISUAL[status].opacity,
      }}
      aria-hidden="true"
    >
      <div className="preserve-3d absolute inset-0" style={{ perspective: '1000px' }}>
        <div className="preserve-3d absolute left-1/2 top-1/2 h-0 w-0">
          {cards.map((c, i) => {
            const isLucky = lucky.has(i)
            const isCalled = calledIds?.has(c.studentId) ?? false
            return (
              <span
                key={c.key}
                ref={(el) => {
                  nodeRefs.current[i] = el
                }}
                className={cn(
                  'stage-card',
                  COLOR_CLASS[c.color],
                  isLucky && 'stage-card--lucky',
                  isCalled && !isLucky && 'stage-card--called',
                )}
                style={{ willChange: 'transform, opacity' }}
              >
                <span className="stage-card__code">{formatCode(c.no)}</span>
                <span
                  ref={(el) => {
                    nameRefs.current[i] = el
                  }}
                  className="stage-card__name"
                >
                  {c.name}
                </span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
