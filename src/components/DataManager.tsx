import { useRef, useState } from 'react'
import {
  Download,
  FileJson,
  RotateCcw,
  Trash2,
  Upload,
  UserPlus,
  Check,
} from 'lucide-react'
import { useRollCallStore, selectActiveClass } from '@/store/rollCallStore'
import {
  STATE_VERSION,
  clearState,
  exportRecordsToCSV,
  exportStateToJSON,
  parseImportedState,
} from '@/lib/storage'
import { Button } from './ui/Button'

export function DataManager() {
  const students = useRollCallStore((s) => s.students)
  const records = useRollCallStore((s) => s.records)
  const allRecords = useRollCallStore((s) => s.allRecords)
  const classes = useRollCallStore((s) => s.classes)
  const activeClassId = useRollCallStore((s) => s.activeClassId)
  const activeClass = useRollCallStore(selectActiveClass)
  const skipCalledToday = useRollCallStore((s) => s.skipCalledToday)
  const setSkipCalledToday = useRollCallStore((s) => s.setSkipCalledToday)
  const settings = useRollCallStore((s) => s.settings)
  const bgmEnabled = useRollCallStore((s) => s.settings.bgmEnabled)
  const bgmVolume = useRollCallStore((s) => s.settings.bgmVolume)
  const soundEnabled = useRollCallStore((s) => s.settings.soundEnabled)
  const toggleBgm = useRollCallStore((s) => s.toggleBgm)
  const setBgmVolume = useRollCallStore((s) => s.setBgmVolume)
  const toggleSound = useRollCallStore((s) => s.toggleSound)
  const addStudent = useRollCallStore((s) => s.addStudent)
  const resetToday = useRollCallStore((s) => s.resetToday)
  const resetAll = useRollCallStore((s) => s.resetAll)
  const importState = useRollCallStore((s) => s.importState)

  const [name, setName] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAdd = () => {
    if (!name.trim()) return
    addStudent(name)
    setName('')
  }

  const handleImport = async (file: File) => {
    const text = await file.text()
    const parsed = parseImportedState(text)
    if (!parsed) {
      useRollCallStore.setState({ notice: '导入失败：文件格式不正确' })
      return
    }
    importState(parsed)
  }

  const handleResetAll = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      // 5 秒后自动取消确认态，避免误触后一直处于危险状态
      window.setTimeout(() => setConfirmReset(false), 5000)
      return
    }
    clearState()
    resetAll()
    setConfirmReset(false)
  }

  return (
    <section aria-label="数据与设置" className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold">数据与设置</h2>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* 名单维护 */}
        <div>
          <h3 className="mb-2 text-xs text-muted-foreground">名单维护</h3>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
              }}
              placeholder="输入学生姓名"
              aria-label="新增学生姓名"
              className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm transition-colors duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button variant="outline" size="sm" onClick={handleAdd} disabled={!name.trim()}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              添加
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {activeClass ? `${activeClass.name} 班` : '当前班级'} · {students.length} 人
          </p>
        </div>

        {/* 点名规则 */}
        <div>
          <h3 className="mb-2 text-xs text-muted-foreground">点名规则</h3>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={skipCalledToday}
              onChange={(e) => setSkipCalledToday(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-border text-accent accent-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span>跳过今日已点过的学生</span>
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            关闭后同一人可在一天内被重复点到
          </p>
        </div>

        {/* 声音 */}
        <div>
          <h3 className="mb-2 text-xs text-muted-foreground">声音</h3>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={bgmEnabled}
              onChange={() => toggleBgm()}
              className="h-4 w-4 cursor-pointer rounded border-border text-accent accent-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span>背景音乐</span>
          </label>

          {bgmEnabled && (
            <div className="mt-2.5 flex items-center gap-2.5">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={bgmVolume}
                onChange={(e) => setBgmVolume(Number(e.target.value))}
                aria-label="背景音乐音量"
                className="h-1.5 w-full max-w-[10rem] cursor-pointer accent-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="tabular w-9 shrink-0 text-xs text-muted-foreground">
                {Math.round(bgmVolume * 100)}%
              </span>
            </div>
          )}

          <label className="mt-2.5 flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={() => toggleSound()}
              className="h-4 w-4 cursor-pointer rounded border-border text-accent accent-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span>点名音效</span>
          </label>

          <p className="mt-2 text-xs text-muted-foreground">
            点名滚动时背景音乐会自动压低，让位给点名音效
          </p>
        </div>

        {/* 导入导出 */}
        <div>
          <h3 className="mb-2 text-xs text-muted-foreground">备份与导出</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportRecordsToCSV(allRecords)}
              disabled={allRecords.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV 记录
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportStateToJSON({
                  version: STATE_VERSION,
                  classes,
                  activeClassId,
                  records: allRecords,
                  settings,
                })
              }
            >
              <FileJson className="h-4 w-4" aria-hidden="true" />
              JSON 备份
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              导入
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleImport(f)
                e.target.value = ''
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            全部班级共 {allRecords.length} 条记录，当前班级 {records.length} 条
          </p>
        </div>

        {/* 重置 */}
        <div>
          <h3 className="mb-2 text-xs text-muted-foreground">重置</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={resetToday} disabled={records.length === 0}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              本班新一轮
            </Button>
            <Button
              variant={confirmReset ? 'danger' : 'outline'}
              size="sm"
              onClick={handleResetAll}
            >
              {confirmReset ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  确认清空全部？
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  清空全部数据
                </>
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            「本班新一轮」仅清空当前班级今日记录，「清空全部」会恢复初始班级与名单
          </p>
        </div>
      </div>
    </section>
  )
}
