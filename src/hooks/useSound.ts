import { useCallback } from 'react'
import { useRollCallStore } from '@/store/rollCallStore'

interface ToneOptions {
  freq: number
  /** 音长（秒） */
  duration: number
  type: OscillatorType
  /** 峰值音量，控制在较低水平，避免课堂环境刺耳 */
  gain: number
}

/** 揭晓音音阶：C5 E5 G5 A5 C6 —— 多人依次揭晓时音高逐级上行 */
const REVEAL_SCALE = [523.25, 659.25, 783.99, 880.0, 1046.5]

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

  const playTone = useCallback(({ freq, duration, type, gain }: ToneOptions) => {
    const ctx = getSharedCtx()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    const now = ctx.currentTime

    osc.type = type
    osc.frequency.setValueAtTime(freq, now)

    // 快速起音 + 指数衰减：避免波形硬起停产生的爆音（click）
    amp.gain.setValueAtTime(0.0001, now)
    amp.gain.linearRampToValueAtTime(gain, now + 0.008)
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    osc.connect(amp)
    amp.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + duration + 0.02)

    // 播完即释放节点，避免长时间点名累积大量 AudioNode
    osc.onended = () => {
      osc.disconnect()
      amp.disconnect()
    }
  }, [])

  /** 滚动滴答声：极轻的短促方波 */
  const tick = useCallback(() => {
    if (!enabled) return
    playTone({ freq: 1000, duration: 0.035, type: 'square', gain: 0.02 })
  }, [enabled, playTone])

  /** 揭晓音：三角波更柔和；多人时音高逐级上行，形成递进感 */
  const reveal = useCallback(
    (index = 0) => {
      if (!enabled) return
      const i = Math.min(Math.max(index, 0), REVEAL_SCALE.length - 1)
      playTone({ freq: REVEAL_SCALE[i], duration: 0.22, type: 'triangle', gain: 0.07 })
    },
    [enabled, playTone],
  )

  /** 开启开关时给一声试听，让用户立刻知道音效是什么 */
  const preview = useCallback(() => {
    playTone({ freq: REVEAL_SCALE[2], duration: 0.22, type: 'triangle', gain: 0.07 })
  }, [playTone])

  const toggle = useCallback(() => {
    const next = !enabled
    toggleSound()
    // 从关到开时补一声试听；关的时候保持安静
    if (next) preview()
  }, [enabled, toggleSound, preview])

  return { enabled, toggle, tick, reveal }
}
