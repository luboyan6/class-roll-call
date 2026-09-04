import { useCallback, useRef } from 'react'
import { useRollCallStore } from '@/store/rollCallStore'

interface ToneOptions {
  freq: number
  /** 音长（秒） */
  duration: number
  type: OscillatorType
  /** 峰值音量，控制在较低水平，避免课堂环境刺耳 */
  gain: number
  /** 起音延迟（秒），用于组合轻快和弦 */
  delay?: number
  /** 音高下滑比例，模拟轻巧的弹跳感 */
  endFreqRatio?: number
}

/** 明亮五声音阶：没有刺耳的小二度，适合课堂中的轻快反馈 */
const REVEAL_SCALE = [523.25, 659.25, 783.99, 880.0, 1046.5]
const TICK_NOTES = [783.99, 987.77, 1174.66, 1318.51]
const PREVIEW_NOTES = [523.25, 659.25, 783.99]

/** 模块级单例：顶栏音效开关与点名舞台共用同一个 AudioContext */
let sharedCtx: AudioContext | null = null

function getSharedCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null

  if (!sharedCtx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    sharedCtx = new Ctor()
  }
  // 浏览器自动播放策略会让上下文挂起，需在用户手势链路中恢复
  if (sharedCtx.state === 'suspended') void sharedCtx.resume()
  return sharedCtx
}

/**
 * 点名音效。
 *
 * 用 Web Audio API 实时合成，不引入任何音频文件：
 * 零体积、零网络请求、离线可用，部署到任何静态托管都不会出现资源 404。
 */
export function useSound() {
  const enabled = useRollCallStore((s) => s.settings.soundEnabled)
  const toggleSound = useRollCallStore((s) => s.toggleSound)

  const playTone = useCallback(
    ({ freq, duration, type, gain, delay = 0, endFreqRatio = 1 }: ToneOptions) => {
      const ctx = getSharedCtx()
      if (!ctx) return

      const osc = ctx.createOscillator()
      const amp = ctx.createGain()
      const now = ctx.currentTime + delay
      const endFreq = freq * endFreqRatio

      osc.type = type
      osc.frequency.setValueAtTime(freq, now)
      if (endFreqRatio !== 1) {
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration)
      }

      // 快速起音 + 指数衰减：避免波形硬起停产生爆音（click）
      amp.gain.setValueAtTime(0.0001, now)
      amp.gain.linearRampToValueAtTime(gain, now + 0.006)
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration)

      osc.connect(amp)
      amp.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + duration + 0.025)

      // 播完即释放节点，避免长时间点名累积大量 AudioNode
      osc.onended = () => {
        osc.disconnect()
        amp.disconnect()
      }
    },
    [],
  )

  /**
   * 滚动音：短促的"啵"声，不再是单调的 1000Hz 方波。
   * 音高轮换 + 轻微下滑，听感像欢快的游戏选项游标，同时保持很低音量。
   */
  const tickIndexRef = useRef(0)
  const tick = useCallback(() => {
    if (!enabled) return
    const index = tickIndexRef.current % TICK_NOTES.length
    tickIndexRef.current += 1
    playTone({
      freq: TICK_NOTES[index],
      duration: 0.075,
      type: 'triangle',
      gain: 0.028,
      endFreqRatio: 0.88,
    })
  }, [enabled, playTone])

  /**
   * 揭晓音：明亮三音和弦 + 轻快高音尾巴。
   * 多人时音阶逐级上行，最后一人会有最高音，形成"开奖"的期待感。
   */
  const reveal = useCallback(
    (index = 0) => {
      if (!enabled) return
      const i = Math.min(Math.max(index, 0), REVEAL_SCALE.length - 1)
      const root = REVEAL_SCALE[i]
      playTone({ freq: root, duration: 0.3, type: 'triangle', gain: 0.065 })
      playTone({ freq: root * 1.5, duration: 0.22, type: 'sine', gain: 0.018, delay: 0.018 })
      playTone({ freq: root * 2, duration: 0.16, type: 'sine', gain: 0.012, delay: 0.045 })
    },
    [enabled, playTone],
  )

  /** 开启开关时播放一个短暂上行琶音，让用户立刻听到完整音色 */
  const preview = useCallback(() => {
    PREVIEW_NOTES.forEach((freq, i) => {
      playTone({ freq, duration: 0.18, type: 'triangle', gain: 0.04, delay: i * 0.065 })
    })
  }, [playTone])

  const toggle = useCallback(() => {
    const next = !enabled
    toggleSound()
    // 从关到开时补一段试听；关的时候保持安静
    if (next) preview()
  }, [enabled, toggleSound, preview])

  return { enabled, toggle, tick, reveal }
}
