import { useEffect, useState, type ReactNode } from 'react'
import {
  Download,
  Maximize,
  Minimize,
  Moon,
  Music,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useRollCallStore } from '@/store/rollCallStore'
import { exportRecordsToCSV } from '@/lib/storage'
import { useTheme } from '@/hooks/useTheme'
import { useSound } from '@/hooks/useSound'
import { useBgm } from '@/hooks/useBgm'
import { cn } from '@/lib/utils'

/**
 * 舞台右侧悬浮工具栏 —— 对应 log-lottery 的 RightButton。
 * 常驻在视口右侧，不随滚动消失，保证点名过程中随时能静音或全屏。
 */

function ToolButton({
  onClick,
  label,
  active,
  children,
}: {
  onClick: () => void
  label: string
  active?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex h-10 w-10 cursor-pointer items-center justify-center rounded-l-xl transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold',
        'bg-slate-500/40 text-stage-text hover:bg-slate-500/70 hover:text-stage-neon',
        active && 'text-stage-gold',
      )}
    >
      {children}
    </button>
  )
}

export function StageToolbar() {
  const records = useRollCallStore((s) => s.records)
  const { theme, toggle: toggleTheme } = useTheme()
  const { enabled: soundEnabled, toggle: toggleSound } = useSound()
  const { enabled: bgmEnabled, toggle: toggleBgm } = useBgm()
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        /* 浏览器拒绝全屏时静默失败即可 */
      })
    }
  }

  return (
    <div className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-2">
      <ToolButton
        onClick={toggleSound}
        label={soundEnabled ? '关闭点名音效' : '开启点名音效'}
        active={soundEnabled}
      >
        {soundEnabled ? (
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <VolumeX className="h-4 w-4" aria-hidden="true" />
        )}
      </ToolButton>

      {/* 背景音乐：关闭时用一条斜线划掉，和「点名音效」的喇叭图标区分开 */}
      <ToolButton
        onClick={toggleBgm}
        label={bgmEnabled ? '关闭背景音乐' : '开启背景音乐'}
        active={bgmEnabled}
      >
        <span className="relative flex items-center justify-center">
          <Music
            className={cn('h-4 w-4', !bgmEnabled && 'opacity-60')}
            aria-hidden="true"
          />
          {!bgmEnabled && (
            <span
              className="absolute h-[1.5px] w-5 rotate-45 rounded-full bg-current"
              aria-hidden="true"
            />
          )}
        </span>
      </ToolButton>

      <ToolButton
        onClick={toggleTheme}
        label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
      >
        {theme === 'dark' ? (
          <Moon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Sun className="h-4 w-4" aria-hidden="true" />
        )}
      </ToolButton>

      <ToolButton onClick={toggleFullscreen} label={isFullscreen ? '退出全屏' : '全屏显示'}>
        {isFullscreen ? (
          <Minimize className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Maximize className="h-4 w-4" aria-hidden="true" />
        )}
      </ToolButton>

      <ToolButton
        onClick={() => exportRecordsToCSV(records)}
        label={records.length === 0 ? '暂无记录可导出' : '导出全部点名记录为 CSV'}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
      </ToolButton>
    </div>
  )
}
