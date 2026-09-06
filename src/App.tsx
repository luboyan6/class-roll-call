import { lazy, Suspense } from 'react'
import { ChevronDown } from 'lucide-react'
import { NoticeBar } from './components/NoticeBar'
import { ParticleField } from './components/ParticleField'
import { RollCallStage } from './components/RollCallStage'
import { StageTitle } from './components/StageTitle'
import { StageToolbar } from './components/StageToolbar'
import { TodayOverview } from './components/TodayOverview'
import { StudentGrid } from './components/StudentGrid'
import { HistorySection } from './components/HistorySection'
import { DataManager } from './components/DataManager'

/**
 * 统计图表依赖 recharts，体积较大且位于首屏之下。
 * 懒加载可让首屏不必下载图表库，显著提升首次加载速度。
 */
const StatsCharts = lazy(() =>
  import('./components/StatsCharts').then((m) => ({ default: m.StatsCharts })),
)

/** 图表加载占位：骨架屏，避免 UI 冻结无反馈 */
function ChartSkeleton() {
  return (
    <section aria-busy="true" aria-label="统计加载中" className="rounded-lg border border-border bg-card p-5">
      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-2.5 w-full animate-pulse rounded-full bg-muted" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      <div className="mt-5 h-[280px] w-full animate-pulse rounded-md bg-muted" />
    </section>
  )
}

/** 首屏底部的下滑提示，暗示下方还有数据面板 */
function ScrollHint() {
  return (
    <a
      href="#dashboard"
      className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-1 text-stage-dim transition-colors duration-200 hover:text-stage-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold"
    >
      <span className="text-xs tracking-widest">出勤记录与名单</span>
      <ChevronDown className="h-4 w-4 animate-bounce" aria-hidden="true" />
    </a>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      {/* 首屏：沉浸式点名舞台 */}
      <section className="stage-backdrop relative flex min-h-screen flex-col overflow-hidden">
        <ParticleField />
        <StageTitle />

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-20 pt-28 sm:pt-32">
          <RollCallStage />
        </div>

        <ScrollHint />
      </section>

      {/* 悬浮工具条：点名过程中随时可用 */}
      <StageToolbar />

      {/* 数据面板 */}
      <section id="dashboard" className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <NoticeBar />
        <TodayOverview />

        <div className="grid gap-6 lg:grid-cols-2">
          <StudentGrid />
          <HistorySection />
        </div>

        <Suspense fallback={<ChartSkeleton />}>
          <StatsCharts />
        </Suspense>

        <DataManager />
      </section>

      <footer className="border-t border-border py-6">
        <p className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground">
          数据保存在本机浏览器，清空缓存或更换设备前请先导出备份
        </p>
      </footer>
    </div>
  )
}
