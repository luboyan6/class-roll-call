import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ListOrdered, Play, Scale, Shuffle, Square, User, Users } from 'lucide-react'
import { useRollCallStore } from '@/store/rollCallStore'
import { useSound } from '@/hooks/useSound'
import { PICK_COUNT_OPTIONS } from '@/lib/storage'
import { fireConfetti } from '@/lib/confetti'
import type { PickMode } from '@/types'
import { cn, todayKey } from '@/lib/utils'
import { NameSphere, type StageStatus } from './NameSphere'
import { NeonButton } from './NeonButton'
import { ResultCards } from './ResultCards'
import { ResultMarkBar } from './ResultMarkBar'

/**
 * 点名舞台 —— 沉浸式主交互区。
 *
 * 状态机完全对齐 log-lottery：
 *   init（面板平铺）→ 进入点名 → ready（聚合成球）→ 开始点名 → rolling（加速自转 + 名字跳动）
 *   → 停止并揭晓 → end（中签卡片飞到镜头前）→ 继续点名 / 返回面板
 *
 * 与参考站保持一致：
 * - 滚动阶段不显示中央大字与"正在随机浏览全班名单"进度条，只让球体高速旋转+名字跳动
 * - 抽取的快慢由老师点击"停止并揭晓"决定，与参考站的人机交互一致
 *
 * 抽取始终只走原始名单，球面上重复的人名只是特效填充。
 */

const REVEAL_STAGGER_MS = 130
/** 滚动期节奏音的间隔 */
const ROLL_TICK_MS = 160

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
  const clearPicks = useRollCallStore((s) => s.clearPicks)

  const { tick: playTick, reveal: playReveal } = useSound()

  /** init 面板态 → ready 球态 → rolling 抽取中 → end 揭晓 */
  const [status, setStatus] = useState<StageStatus>('init')
  /** 用 ref 持有最新音效函数，避免回调变化导致定时器被反复重建 */
  const soundRef = useRef({ playTick, playReveal })
  soundRef.current = { playTick, playReveal }

  /** 今日已点名的学生，卡片显示为已处理状态 */
  const calledIds = useMemo(() => {
    const date = todayKey()
    return new Set(records.filter((r) => r.date === date).map((r) => r.studentId))
  }, [records])

  /**
   * 滚动期节奏音：球体高速旋转时持续发出短促的滴答声，
   * 像老虎机滚轮一样累积期待感（音效开关关闭时 useSound 内部会直接忽略）。
   */
  useEffect(() => {
    if (status !== 'rolling') return
    const id = window.setInterval(() => soundRef.current.playTick(), ROLL_TICK_MS)
    return () => window.clearInterval(id)
  }, [status])

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

  const hasResult = status === 'end' && currentPicks.length > 0
  const activeMode = MODES.find((m) => m.key === mode) ?? MODES[0]
  const canRoll = students.length > 0

  const handleEnter = () => {
    if (!canRoll) return
    soundRef.current.playTick()
    setStatus('ready')
  }

  const handleStart = () => {
    if (!canRoll) return
    clearPicks()
    startRoll()
    setStatus('rolling')
  }

  const handleStop = () => {
    finishRoll()
    setStatus('end')
  }

  const handleQuit = () => {
    clearPicks()
    setStatus('init')
  }

  return (
    <section aria-label="点名舞台" className="flex w-full flex-col items-center">
      {/* 球体 / 面板舞台 */}
      <div className="relative flex h-[360px] w-full items-center justify-center sm:h-[440px] lg:h-[480px]">
        <NameSphere
          students={students}
          status={status}
          highlightIds={hasResult ? currentPicks.map((s) => s.id) : []}
          calledIds={calledIds}
        />

        {/* 中央层只显示结果卡（init/ready/rolling 都让球体自己说话，与参考站一致） */}
        {hasResult && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
            <motion.div
              key={`result-${currentPicks.map((s) => s.id).join('-')}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full"
            >
              <ResultCards students={currentPicks} />
            </motion.div>
          </div>
        )}
      </div>

      {/* 结果出勤快捷标记 */}
      {hasResult && <ResultMarkBar picks={currentPicks} />}

      {/* CTA：与 log-lottery 的状态分工一致 */}
      <div className="mt-4 flex min-h-[4.5rem] flex-col items-center justify-center gap-4">
        {status === 'init' && (
          <NeonButton variant="neon" onClick={handleEnter} disabled={!canRoll}>
            进入点名
          </NeonButton>
        )}

        {status === 'ready' && (
          <NeonButton variant="stars" onClick={handleStart} disabled={!canRoll}>
            <Play className="h-4 w-4" aria-hidden="true" />
            {pickCount > 1 ? `开始抽 ${pickCount} 人` : '开始点名'}
          </NeonButton>
        )}

        {status === 'rolling' && (
          <NeonButton variant="neon" onClick={handleStop}>
            <Square className="mr-1.5 inline-block h-3.5 w-3.5" aria-hidden="true" />
            停止并揭晓
          </NeonButton>
        )}

        {status === 'end' && (
          <div className="flex flex-wrap items-center justify-center gap-5">
            <NeonButton variant="stars" onClick={handleStart} disabled={!canRoll}>
              继续点名
            </NeonButton>
            <NeonButton variant="cancel" onClick={handleQuit}>
              返回面板
            </NeonButton>
          </div>
        )}
      </div>

      {/* 抽取人数 + 模式 */}
      <div className="mt-5 flex flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-xs text-stage-dim">人数</span>
          {PICK_COUNT_OPTIONS.map((n) => {
            const meta = COUNT_META[n]
            const Icon = meta.icon
            return (
              <Pill
                key={n}
                active={n === pickCount}
                disabled={status === 'rolling'}
                onClick={() => setPickCount(n)}
                title={meta.hint}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {meta.label}
              </Pill>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-xs text-stage-dim">模式</span>
          {MODES.map((m) => {
            const Icon = m.icon
            return (
              <Pill
                key={m.key}
                active={m.key === mode}
                disabled={status === 'rolling'}
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
