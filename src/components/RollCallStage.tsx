import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ListOrdered, Play, Scale, Shuffle, User, Users } from 'lucide-react'
import { useRollCallStore } from '@/store/rollCallStore'
import { useSound } from '@/hooks/useSound'
import { PICK_COUNT_OPTIONS } from '@/lib/storage'
import type { PickMode, Student } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from './ui/Button'

/** 单人逐名浏览；多人按不重复的小组浏览，全班名单完整出现一遍后才揭晓 */
const ROLL_STEP_MS: Record<number, number> = {
  1: 180,
  3: 480,
  5: 700,
}
const REVEAL_HOLD_MS = 900
/** 多人依次揭晓的间隔，与动画 delay 对齐 */
const REVEAL_STAGGER_MS = 130

const MODES: { key: PickMode; label: string; icon: typeof Shuffle; hint: string }[] = [
  { key: 'weighted', label: '加权随机', icon: Scale, hint: '被点少的人概率更高，长期公平' },
  { key: 'random', label: '纯随机', icon: Shuffle, hint: '每人概率相同' },
  { key: 'sequential', label: '顺序轮询', icon: ListOrdered, hint: '按名单依次点名' },
]

/** 抽取人数按钮 */
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

/**
 * 取出滚动中的一组名字。
 * 单人模式每次展示 1 人；3/5 人模式按不重叠的小组展示，保证全班每人都出现一次。
 */
function rollGroup(sequence: Student[], groupIndex: number, count: number): string[] {
  return Array.from({ length: count }, (_, slot) => sequence[groupIndex * count + slot]?.name ?? '')
}

export function RollCallStage() {
  const students = useRollCallStore((s) => s.students)
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

  const [displayNames, setDisplayNames] = useState<string[]>([])
  const [rollProgress, setRollProgress] = useState(0)
  const [rollFrame, setRollFrame] = useState(0)
  const timerRef = useRef<number | null>(null)
  /** 用 ref 持有最新音效函数，避免回调变化导致滚动定时器被反复重建 */
  const soundRef = useRef({ playTick, playReveal })
  soundRef.current = { playTick, playReveal }

  /**
   * 滚动动画：先把全班名单打乱，再逐组浏览完整一遍。
   * 这样不是"随机几个人就停"，而是每次点名都有约 5 秒的完整随机浏览过程。
   */
  useEffect(() => {
    if (!isRolling) {
      setRollProgress(0)
      return
    }

    const count = useRollCallStore.getState().settings.pickCount
    const sequence = shuffle([...useRollCallStore.getState().students])
    const totalGroups = Math.ceil(sequence.length / count)
    let nextGroup = 1

    if (sequence.length === 0 || totalGroups === 0) {
      finishRoll()
      return
    }

    const showGroup = (groupIndex: number) => {
      setDisplayNames(rollGroup(sequence, groupIndex, count))
      setRollFrame((frame) => frame + 1)
      setRollProgress(Math.min(((groupIndex + 1) * count) / sequence.length, 1))
      soundRef.current.playTick()
    }

    // 第一组立即出现，随后按节奏切换剩余小组，避免点击后空等
    showGroup(0)

    if (reduceMotion) {
      timerRef.current = window.setTimeout(() => finishRoll(), 120)
      return () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      }
    }

    const stepMs = ROLL_STEP_MS[count] ?? ROLL_STEP_MS[1]
    const showNextGroup = () => {
      if (nextGroup >= totalGroups) {
        // 最后一组多停留一会儿，给课堂现场一个明确的"即将揭晓"悬念
        timerRef.current = window.setTimeout(() => finishRoll(), REVEAL_HOLD_MS)
        return
      }

      showGroup(nextGroup)
      nextGroup += 1
      timerRef.current = window.setTimeout(showNextGroup, stepMs)
    }

    timerRef.current = window.setTimeout(showNextGroup, stepMs)

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [isRolling, reduceMotion, finishRoll])

  /** 揭晓音效：仅在"滚动结束 → 出结果"这一刻播放，标记出勤导致的队列变化不触发 */
  const prevRolling = useRef(false)
  useEffect(() => {
    if (prevRolling.current && !isRolling && currentPicks.length > 0) {
      currentPicks.forEach((_, i) => {
        window.setTimeout(() => soundRef.current.playReveal(i), i * REVEAL_STAGGER_MS)
      })
    }
    prevRolling.current = isRolling
  }, [isRolling, currentPicks])

  /** 揭晓后同步显示真实结果；清空 picks 时也要同步清掉本地显示缓存 */
  useEffect(() => {
    if (!isRolling) {
      setDisplayNames(currentPicks.length > 0 ? currentPicks.map((s) => s.name) : [])
    }
  }, [isRolling, currentPicks])

  const isIdle = !isRolling && currentPicks.length === 0
  const isMulti = pickCount > 1
  const activeMode = MODES.find((m) => m.key === mode) ?? MODES[0]

  /** 多人用网格排布，单人居中大字；姓名本身不再显示学号 */
  const gridClass = isMulti
    ? pickCount <= 3
      ? 'grid w-full grid-cols-1 gap-4 sm:grid-cols-3'
      : 'grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5'
    : ''

  const nameSize = !isMulti
    ? 'text-7xl sm:text-8xl md:text-9xl'
    : pickCount <= 3
      ? 'text-4xl sm:text-5xl md:text-6xl'
      : 'text-3xl sm:text-4xl md:text-5xl'

  return (
    <section aria-label="点名舞台" className="rounded-lg border border-border bg-card p-6 sm:p-8">
      {/* 姓名展示区 */}
      <div className="flex min-h-[210px] items-center justify-center sm:min-h-[260px]">
        <AnimatePresence mode="wait">
          {isIdle ? (
            <motion.p
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-center text-lg text-muted-foreground sm:text-xl"
            >
              点击下方按钮开始点名
            </motion.p>
          ) : isRolling ? (
            <motion.div
              key="rolling"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full"
            >
              <div className="relative flex min-h-[155px] items-center justify-center overflow-hidden rounded-xl border border-accent/20 bg-accent/[0.03] px-3 py-6 sm:min-h-[190px] sm:px-6">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                  <motion.div
                    className="h-56 w-56 rounded-full border border-dashed border-accent/30"
                    animate={{ rotate: 360, scale: [0.92, 1.04, 0.92], opacity: [0.45, 0.85, 0.45] }}
                    transition={{ rotate: { duration: 5, repeat: Infinity, ease: 'linear' }, duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.div
                    className="absolute h-40 w-40 rounded-full border border-accent/15"
                    animate={{ rotate: -360, scale: [1.05, 0.9, 1.05] }}
                    transition={{ rotate: { duration: 3.8, repeat: Infinity, ease: 'linear' }, duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>

                <div className={cn(gridClass, 'relative z-10')}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {displayNames.map((name, i) => (
                      <motion.span
                        key={`${name || 'empty'}-${i}-${rollFrame}`}
                        initial={{ opacity: 0, y: 12, scale: 0.9, filter: 'blur(5px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -12, scale: 1.06, filter: 'blur(4px)' }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className={cn(
                          'block text-center font-display font-black leading-tight tracking-wide text-accent',
                          nameSize,
                        )}
                      >
                        {name || '—'}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              <div className="mx-auto mt-4 w-full max-w-md" role="status" aria-live="polite">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    animate={{ width: `${Math.round(rollProgress * 100)}%` }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  />
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  正在随机浏览全班名单 · 已浏览 {Math.round(rollProgress * students.length)} / {students.length} 人
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`result-${currentPicks.map((s) => s.id).join('-')}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={cn(gridClass, 'w-full')}
            >
              {currentPicks.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, scale: 0.85, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: i * 0.12, duration: 0.3, ease: 'easeOut' }}
                  className="text-center"
                >
                  <span
                    className={cn(
                      'block font-display font-black leading-tight tracking-wide text-accent',
                      nameSize,
                    )}
                  >
                    {s.name}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA —— 首屏可见 */}
      <div className="mt-6 flex flex-col items-center gap-5">
        <Button
          size="lg"
          variant="accent"
          onClick={startRoll}
          disabled={isRolling || students.length === 0}
          className="w-full max-w-xs text-base font-semibold"
        >
          <Play className="h-5 w-5" aria-hidden="true" />
          {isRolling ? '正在浏览全班…' : pickCount > 1 ? `抽取 ${pickCount} 人` : '开始点名'}
        </Button>

        {/* 抽取人数 */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-xs text-muted-foreground">人数</span>
          {PICK_COUNT_OPTIONS.map((n) => {
            const meta = COUNT_META[n]
            const Icon = meta.icon
            const active = n === pickCount
            return (
              <button
                key={n}
                type="button"
                onClick={() => setPickCount(n)}
                disabled={isRolling}
                title={meta.hint}
                aria-pressed={active}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  active
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {meta.label}
              </button>
            )
          })}
        </div>

        {/* 模式选择 */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-xs text-muted-foreground">模式</span>
          {MODES.map((m) => {
            const Icon = m.icon
            const active = m.key === mode
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                disabled={isRolling}
                title={m.hint}
                aria-pressed={active}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  active
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {m.label}
              </button>
            )
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {isMulti ? `${COUNT_META[pickCount]?.hint ?? ''} · ${activeMode.hint}` : activeMode.hint}
        </p>
      </div>
    </section>
  )
}
