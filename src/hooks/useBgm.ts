import { useCallback, useEffect } from 'react'
import { useRollCallStore } from '@/store/rollCallStore'
import { BGM_SRC } from '@/lib/storage'

/**
 * 背景音乐。
 *
 * 与点名音效（Web Audio 实时合成）不同，BGM 是一整首曲子，所以走 <audio>：
 * - 单例：工具栏开关与页面任何地方共用同一个元素，不会出现两首歌叠着放
 * - 懒加载：preload=none，只有真的开了才去下载，没开时不浪费流量
 * - 淡入淡出：直接切音量会有明显的"啪"一声
 * - 自动播放策略：浏览器不允许无声播放，被拒后挂一次性手势监听，
 *   用户第一次点击/按键时再补上
 */

const FADE_MS = 700
/** 点名滚动时把音乐压到这个比例，让位给点名音效；揭晓后自动抬回来 */
const DUCK_RATIO = 0.28

let audio: HTMLAudioElement | null = null
let fadeTimer: number | null = null
let duckTimer: number | null = null
/** 目标音量（0~1），duck 期间实际音量为 target * DUCK_RATIO */
let targetVolume = 0
let ducking = false
let unlockArmed = false

function clearFade() {
  if (fadeTimer !== null) {
    window.clearInterval(fadeTimer)
    fadeTimer = null
  }
}

/** 音量渐变，避免硬切产生爆音 */
function fadeTo(el: HTMLAudioElement, from: number, to: number, ms: number) {
  clearFade()
  const step = 20
  const delta = ((to - from) * step) / ms
  if (delta === 0) {
    el.volume = to
    return
  }
  let cur = from
  el.volume = cur
  fadeTimer = window.setInterval(() => {
    cur += delta
    if ((delta > 0 && cur >= to) || (delta < 0 && cur <= to)) {
      el.volume = to
      clearFade()
      return
    }
    el.volume = Math.max(0, Math.min(1, cur))
  }, step)
}

function applyVolume(el: HTMLAudioElement, immediate = false) {
  const to = ducking ? targetVolume * DUCK_RATIO : targetVolume
  if (immediate) {
    clearFade()
    el.volume = to
    return
  }
  fadeTo(el, el.volume, to, FADE_MS)
}

/**
 * 浏览器自动播放策略下，play() 可能直接 reject。
 * 被拒后挂一个一次性监听：用户第一次真正交互时补播。
 */
function playWithUnlock(el: HTMLAudioElement) {
  const attempt = () => {
    const p = el.play()
    if (p && typeof p.catch === 'function') {
      p.catch(() => armUnlock(el))
    }
  }
  attempt()
}

function armUnlock(el: HTMLAudioElement) {
  if (unlockArmed) return
  unlockArmed = true

  const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart']
  const handler = () => {
    events.forEach((e) => window.removeEventListener(e, handler))
    unlockArmed = false
    // 用户在首次交互期间可能恰好关闭了音乐，此时就别再硬播了
    if (!useRollCallStore.getState().settings.bgmEnabled) return
    void el.play().catch(() => {
      /* 仍然失败就保持静默，不打扰用户 */
    })
  }
  events.forEach((e) => window.addEventListener(e, handler, { passive: true }))
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio()
    audio.loop = true
    // 关键：不开就不下载，7~8MB 的曲子不该白白占用带宽
    audio.preload = 'none'
    audio.src = BGM_SRC
    audio.volume = 0
    // 挂到文档里（隐藏），方便排查"到底有没有在放"，也符合 <audio> 的常规用法
    audio.dataset.bgm = 'true'
    audio.className = 'hidden'
    document.body.appendChild(audio)
  }
  return audio
}

/**
 * 开始压低背景音乐（点名滚动阶段调用），让位给点名音效。
 * 供舞台直接调用，不必经过 hook。
 */
export function duckBgm() {
  const el = audio
  if (!el || el.paused || ducking) return
  ducking = true
  if (duckTimer !== null) {
    window.clearTimeout(duckTimer)
    duckTimer = null
  }
  applyVolume(el)
}

/** 恢复背景音乐音量（停止滚动 / 揭晓时调用） */
export function unduckBgm() {
  const el = audio
  if (!el || !ducking) return
  ducking = false
  if (duckTimer !== null) {
    window.clearTimeout(duckTimer)
    duckTimer = null
  }
  applyVolume(el)
}

export function useBgm() {
  const enabled = useRollCallStore((s) => s.settings.bgmEnabled)
  const volume = useRollCallStore((s) => s.settings.bgmVolume)
  const toggleBgm = useRollCallStore((s) => s.toggleBgm)
  const setBgmVolume = useRollCallStore((s) => s.setBgmVolume)

  // 开关 / 音量变化 → 同步到真实音频元素
  useEffect(() => {
    const el = getAudio()
    targetVolume = enabled ? volume : 0

    if (!enabled) {
      // 关的时候淡出再暂停，立刻 pause 会有咔哒声
      fadeTo(el, el.volume, 0, 400)
      const t = window.setTimeout(() => {
        if (!useRollCallStore.getState().settings.bgmEnabled) el.pause()
      }, 420)
      return () => window.clearTimeout(t)
    }

    applyVolume(el, el.paused)
    playWithUnlock(el)
    return undefined
  }, [enabled, volume])

  // 切到别的窗口时暂停，避免老师在 PPT 上讲课，这边还在放歌
  useEffect(() => {
    const onVisibility = () => {
      const el = getAudio()
      const on = useRollCallStore.getState().settings.bgmEnabled
      if (!on) return
      if (document.hidden) {
        el.pause()
      } else {
        void el.play().catch(() => armUnlock(el))
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const toggle = useCallback(() => {
    toggleBgm()
  }, [toggleBgm])

  return { enabled, volume, toggle, setVolume: setBgmVolume }
}
