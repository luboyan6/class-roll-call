import { lazy, Suspense } from 'react'
import { Header } from './components/Header'
import { NoticeBar } from './components/NoticeBar'
import { RollCallStage } from './components/RollCallStage'
import { StatusPicker } from './components/StatusPicker'
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

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <NoticeBar />

        {/* 主区：点名舞台（CTA，首屏可见）+ 辅助面板 */}
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <RollCallStage />
            <StatusPicker />
          </div>

          <div className="space-y-6 lg:col-span-2">
            <TodayOverview />
            <StudentGrid compact />
          </div>
        </div>

        <Suspense fallback={<ChartSkeleton />}>
          <StatsCharts />
        </Suspense>

        <HistorySection />
        <DataManager />
      </main>

      <footer className="border-t border-border py-6">
        <p className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground">
          数据保存在本机浏览器，清空缓存或更换设备前请先导出备份
        </p>
      </footer>
    </div>
  )
}
