import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ListOrdered, Play, Scale, Shuffle, Square, User, Users } from 'lucide-react'
import { useRollCallStore } from '@/store/rollCallStore'
import { useSound } from '@/hooks/useSound'
import { PICK_COUNT_OPTIONS } from '@/lib/storage'
import { fireConfetti } from '@/lib/confetti'
import type { PickMode, Student } from '@/types'
import { cn, todayKey } from '@/lib/utils'
import { NameSphere, type SpherePhase } from './NameSphere'
import { ResultCards } from './ResultCards'
import { ResultMarkBar } from './ResultMarkBar'

/**
 * 点名舞台 —— 沉浸式主交互区。
 *
 * 交互流程对齐 log-lottery：待机球面慢转 → 点名时球面加速并随机跳动名字 → 揭晓时
 * 结果卡片从球面"飞"到镜头正前方并放礼花。差异在于点名场景需要"把全班浏览一遍"，
 * 所以滚动阶段额外保留中央大字 + 进度反馈，让老师知道系统确实扫过了每一个人。
 */

/** 中途始终单人逐名浏览；抽取人数只影响滚动节奏，不影响中途的展示数量 */
const ROLL_STEP_MS: Record<number, number> = {
  1: 180,
  3: 190,
  5: 200,
}
const REVEAL_HOLD_MS = 900
/** 多人依次揭晓的间隔，与动画 delay 对齐 */
const REVEAL_STAGGER_MS = 130

const MODES: { key: PickMode; label: string; icon: typeof Shuffle; hint: string }[] = [
  { key: 'weighted', label: '加权随机', icon: Scale, hint: '被点少的人概率更高，长期公平' },
  { key: 'random', label: '纯随机', icon: Shuffle, hint: '每人概率相同' },
  { key: 'sequential', label: '顺序轮询', icon: ListOrdered, hint: '按名单依次点名' },
]

const COUNT_META: Record<number, { label: string; icon: typeof User; hint: string }> = {
  1: { label: '单人', icon: User, hint: '一次点 1 人' },
  3: { label: '3 人', icon: Users, hint: '一次抽 3 人，适合小组提问' },
  5: { label: '5 人', icon: Users, hint: '一次抽 5 人，适合小组提问' },
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

/** 取出滚动中的当前名字：全班名单会逐人出现一次，再循环到开头。 */
function rollName(sequence: Student[], index: number): string {
  return sequence[index % sequence.length]?.name ?? ''
}

/** 胶囊按钮：人数 / 模式切换共用 */
function Pill({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  title?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold focus-visible:ring-offset-2 focus-visible:ring-offset-stage-bg',
        'disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-stage-gold/70 bg-stage-gold/15 text-stage-gold shadow-[0_0_16px_rgba(247,206,104,0.25)]'
          : 'border-stage-line bg-stage-panel text-stage-dim hover:border-stage-neon/40 hover:text-stage-text',
      )}
    >
      {children}
    </button>
  )
}

export function RollCallStage() {
  const students = useRollCallStore((s) => s.students)
  const records = useRollCallStore((s) => s.records)
  const isRolling = useRollCallStore((s) => s.isRolling)
  const currentPicks = useRollCallStore((s) => s.currentPicks)
  const mode = useRollCallStore((s) => s.mode)
  const pickCount = useRollCallStore((s) => s.settings.pickCount)
  const setMode = useRollCallStore((s) => s.setMode)
  const setPickCount = useRollCallStore((s) => s.setPickCount)
  const startRoll = useRollCallStore((s) => s.startRoll)
  const finishRoll = useRollCallStore((s) => s.finishRoll)

  const reduceMotion = useReducedMotion()
  const { tick: playTick, reveal: playReveal } = useSound()

  const [displayName, setDisplayName] = useState('')
  const [rollProgress, setRollProgress] = useState(0)
  const [rollFrame, setRollFrame] = useState(0)
  const timerRef = useRef<number | null>(null)
  /** 用 ref 持有最新音效函数，避免回调变化导致滚动定时器被反复重建 */
  const soundRef = useRef({ playTick, playReveal })
  soundRef.current = { playTick, playReveal }

  /** 今日已点名的学生，球面上对应卡片显示为已处理状态 */
  const calledIds = useMemo(() => {
    const date = todayKey()
    return new Set(records.filter((r) => r.date === date).map((r) => r.studentId))
  }, [records])

  /**
   * 滚动动画：先把全班名单打乱，再逐人浏览完整一遍。
   * 期间球面高速自转并随机跳动卡片名字，双重反馈制造悬念。
   */
  useEffect(() => {
    if (!isRolling) {
      setRollProgress(0)
      return
    }

    const count = useRollCallStore.getState().settings.pickCount
    const sequence = shuffle([...useRollCallStore.getState().students])
    let nextIndex = 1

    if (sequence.length === 0) {
      finishRoll()
      return
    }

    const showName = (index: number) => {
      setDisplayName(rollName(sequence, index))
      setRollFrame((frame) => frame + 1)
      setRollProgress(Math.min((index + 1) / sequence.length, 1))
      soundRef.current.playTick()
    }

    showName(0)

    if (reduceMotion) {
      timerRef.current = window.setTimeout(() => finishRoll(), 120)
      return () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      }
    }

    const stepMs = ROLL_STEP_MS[count] ?? ROLL_STEP_MS[1]
    const showNextName = () => {
      if (nextIndex >= sequence.length) {
        // 全班都出现过后再停留一会儿，给课堂现场一个明确的"即将揭晓"悬念
        timerRef.current = window.setTimeout(() => finishRoll(), REVEAL_HOLD_MS)
        return
      }

      showName(nextIndex)
      nextIndex += 1
      timerRef.current = window.setTimeout(showNextName, stepMs)
    }

    timerRef.current = window.setTimeout(showNextName, stepMs)

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [isRolling, reduceMotion, finishRoll])

  /** 揭晓瞬间：音效 + 礼花 */
  const prevRolling = useRef(false)
  useEffect(() => {
    if (prevRolling.current && !isRolling && currentPicks.length > 0) {
      currentPicks.forEach((_, i) => {
        window.setTimeout(() => soundRef.current.playReveal(i), i * REVEAL_STAGGER_MS)
      })
      fireConfetti(0)
    }
    prevRolling.current = isRolling
  }, [isRolling, currentPicks])

  const hasResult = !isRolling && currentPicks.length > 0
  const isIdle = !isRolling && currentPicks.length === 0
  const activeMode = MODES.find((m) => m.key === mode) ?? MODES[0]

  const spherePhase: SpherePhase = isRolling ? 'rolling' : hasResult ? 'revealed' : 'idle'
  const sphereRadius = useResponsiveRadius()

  return (
    <section aria-label="点名舞台" className="flex w-full flex-col items-center">
      {/* 球体舞台 */}
      <div className="relative flex h-[340px] w-full items-center justify-center sm:h-[420px] lg:h-[460px]">
        <NameSphere
          students={students}
          phase={spherePhase}
          highlightIds={currentPicks.map((s) => s.id)}
          calledIds={calledIds}
          radius={sphereRadius}
        />

        {/* 中央层：滚动大字 / 结果卡片 / 待机提示 */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
          <AnimatePresence mode="wait">
            {isRolling ? (
              <motion.div
                key="rolling"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.06 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex w-full flex-col items-center"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={`${displayName || 'empty'}-${rollFrame}`}
                    initial={{ opacity: 0, y: 14, scale: 0.9, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -14, scale: 1.06, filter: 'blur(5px)' }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="block text-center font-display text-6xl font-black leading-tight tracking-wide text-gold-gradient name-glow sm:text-7xl md:text-8xl"
                  >
                    {displayName || '—'}
                  </motion.span>
                </AnimatePresence>

                <div className="mt-7 w-full max-w-sm" role="status" aria-live="polite">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-stage-amber to-stage-gold"
                      animate={{ width: `${Math.round(rollProgress * 100)}%` }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="mt-2 text-center text-xs text-stage-dim">
                    正在随机浏览全班名单 · 已浏览 {Math.round(rollProgress * students.length)} /{' '}
                    {students.length} 人
                  </p>
                </div>
              </motion.div>
            ) : hasResult ? (
              <motion.div
                key={`result-${currentPicks.map((s) => s.id).join('-')}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <ResultCards students={currentPicks} />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-center"
              >
                <p className="text-lg text-stage-dim sm:text-xl">点击下方按钮开始点名</p>
                <p className="mt-2 text-xs text-stage-dim/70">
                  全班 {students.length} 人 · 每次都会随机浏览一遍再揭晓
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 结果出勤快捷标记 */}
      <ResultMarkBar picks={currentPicks} />

      {/* CTA */}
      <div className="mt-7 flex flex-col items-center gap-5">
        <div className="relative">
          {isIdle && (
            <span
              className="pointer-events-none absolute inset-0 animate-halo rounded-full bg-stage-gold/40 blur-md"
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            onClick={isRolling ? finishRoll : startRoll}
            disabled={!isRolling && students.length === 0}
            className={cn(
              'relative inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-full px-12 py-4 text-base font-bold tracking-wide transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold focus-visible:ring-offset-2 focus-visible:ring-offset-stage-bg',
              'disabled:cursor-not-allowed disabled:opacity-50',
              isRolling
                ? 'border border-stage-neon/60 bg-stage-neon/15 text-stage-neon shadow-[0_0_30px_rgba(79,216,255,0.3)] hover:bg-stage-neon/25'
                : 'border border-stage-gold/70 bg-gradient-to-b from-stage-gold to-stage-amber text-[#2A1A00] shadow-[0_0_34px_rgba(247,206,104,0.35)] hover:brightness-110',
            )}
          >
            {isRolling ? (
              <>
                <Square className="h-5 w-5" aria-hidden="true" />
                停止并揭晓
              </>
            ) : (
              <>
                <Play className="h-5 w-5" aria-hidden="true" />
                {pickCount > 1 ? `抽取 ${pickCount} 人` : '开始点名'}
              </>
            )}
          </button>
        </div>

        {/* 抽取人数 */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-xs text-stage-dim">人数</span>
          {PICK_COUNT_OPTIONS.map((n) => {
            const meta = COUNT_META[n]
            const Icon = meta.icon
            return (
              <Pill
                key={n}
                active={n === pickCount}
                disabled={isRolling}
                onClick={() => setPickCount(n)}
                title={meta.hint}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {meta.label}
              </Pill>
            )
          })}
        </div>

        {/* 模式选择 */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-xs text-stage-dim">模式</span>
          {MODES.map((m) => {
            const Icon = m.icon
            return (
              <Pill
                key={m.key}
                active={m.key === mode}
                disabled={isRolling}
                onClick={() => setMode(m.key)}
                title={m.hint}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {m.label}
              </Pill>
            )
          })}
        </div>

        <p className="text-center text-xs text-stage-dim">
          {pickCount > 1
            ? `${COUNT_META[pickCount]?.hint ?? ''} · ${activeMode.hint}`
            : activeMode.hint}
        </p>
      </div>
    </section>
  )
}

/** 球面半径随视口宽度自适应，保证手机上也装得下整颗球 */
function useResponsiveRadius(): number {
  const [radius, setRadius] = useState(200)

  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth
      setRadius(w < 400 ? 120 : w < 640 ? 155 : w < 1024 ? 195 : 225)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  return radius
}
