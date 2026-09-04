import { Download, GraduationCap, Moon, Sun, Volume2, VolumeX } from 'lucide-react'
import { useRollCallStore } from '@/store/rollCallStore'
import { exportRecordsToCSV } from '@/lib/storage'
import { formatChineseDate, formatWeekday } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { useSound } from '@/hooks/useSound'
import { Button } from './ui/Button'

export function Header() {
  const records = useRollCallStore((s) => s.records)
  const { theme, toggle: toggleTheme } = useTheme()
  const { enabled: soundEnabled, toggle: toggleSound } = useSound()
  const now = new Date()

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent"
            aria-hidden="true"
          >
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">图图课堂点名系统</h1>
            <p className="text-xs text-muted-foreground">
              {formatChineseDate(now)} · {formatWeekday(now)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSound}
            aria-label={soundEnabled ? '关闭点名音效' : '开启点名音效'}
            aria-pressed={soundEnabled}
            title={soundEnabled ? '音效已开启，点击关闭' : '音效已关闭，点击开启'}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => exportRecordsToCSV(records)}
            disabled={records.length === 0}
            title="导出全部点名记录为 CSV"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">导出记录</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
            title={theme === 'dark' ? '浅色模式' : '深色模式'}
          >
            {theme === 'dark' ? (
              <Moon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
