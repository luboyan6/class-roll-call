import { useMemo, useState } from 'react'
import {
  Check,
  ClipboardPaste,
  Pencil,
  Plus,
  School,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useRollCallStore, selectActiveClass } from '@/store/rollCallStore'
import { parseRosterText } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { Button } from './ui/Button'

/**
 * 班级管理区（位于下方数据面板）。
 *
 * 设计目标是"后面还能继续加班"：班级数量、名单来源都不写死，
 * 老师粘贴一段表格文本就能建班或换名单，不用一个一个敲名字。
 */
export function ClassManager() {
  const classes = useRollCallStore((s) => s.classes)
  const activeClassId = useRollCallStore((s) => s.activeClassId)
  const activeClass = useRollCallStore(selectActiveClass)
  const setActiveClass = useRollCallStore((s) => s.setActiveClass)
  const addClass = useRollCallStore((s) => s.addClass)
  const renameClass = useRollCallStore((s) => s.renameClass)
  const removeClass = useRollCallStore((s) => s.removeClass)
  const isRolling = useRollCallStore((s) => s.isRolling)

  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [rosterText, setRosterText] = useState('')

  /** 粘贴区实时预览：老师们粘完就能看到识别结果，不用先点一次"解析" */
  const preview = useMemo(() => {
    const text = rosterText.trim()
    if (!text) return null
    return parseRosterText(text, activeClass?.name ?? '')
  }, [rosterText, activeClass?.name])

  const previewTotal = preview?.reduce((n, p) => n + p.students.length, 0) ?? 0
  const noClassColumn = preview?.some((p) => !p.className) ?? false

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    addClass(name)
    setNewName('')
  }

  const handleRename = () => {
    if (!editing) return
    const name = editing.name.trim()
    if (name) renameClass(editing.id, name)
    setEditing(null)
  }

  const handleRemove = (classId: string) => {
    if (confirmId !== classId) {
      setConfirmId(classId)
      // 5 秒后自动取消确认态，避免误触后一直停在危险状态
      window.setTimeout(() => setConfirmId((cur) => (cur === classId ? null : cur)), 5000)
      return
    }
    removeClass(classId)
    setConfirmId(null)
  }

  /** 把解析结果写进班级：同名班级覆盖名单，新班级直接建出来 */
  const handleApplyRoster = () => {
    if (!preview || preview.length === 0) return
    const keepActiveId = useRollCallStore.getState().activeClassId

    for (const p of preview) {
      const name = p.className.trim()
      if (!name) continue
      const st = useRollCallStore.getState()
      const existing = st.classes.find((c) => c.name === name)
      if (existing) st.setClassStudents(existing.id, p.students)
      else st.addClass(name, p.students)
    }

    // 新建班级会自动切过去，这里把焦点还给老师原来那个班
    const after = useRollCallStore.getState()
    if (after.classes.some((c) => c.id === keepActiveId) && after.activeClassId !== keepActiveId) {
      after.setActiveClass(keepActiveId)
    }
    useRollCallStore.setState({
      notice:
        preview.length === 1
          ? `已导入 ${preview[0].className} 班名单（${preview[0].students.length} 人）`
          : `已导入 ${preview.length} 个班级、共 ${previewTotal} 人`,
    })
    setRosterText('')
  }

  return (
    <section
      id="class-manager"
      aria-label="班级管理"
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">班级管理</h2>
        <p className="text-xs text-muted-foreground">
          共 {classes.length} 个班级 · 名单、记录、出勤统计按班级分开
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 左：班级列表 + 新建 */}
        <div>
          <h3 className="mb-2 text-xs text-muted-foreground">班级列表</h3>

          <ul className="space-y-2">
            {classes.map((c) => {
              const active = c.id === activeClassId
              const editingThis = editing?.id === c.id
              return (
                <li
                  key={c.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 transition-colors duration-200',
                    active ? 'border-accent bg-accent/5' : 'border-border bg-background',
                  )}
                >
                  {editingThis ? (
                    <>
                      <input
                        autoFocus
                        value={editing.name}
                        onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename()
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        aria-label={`重命名 ${c.name} 班`}
                        className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={handleRename}
                        aria-label="保存班级名"
                        title="保存"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setEditing(null)}
                        aria-label="取消重命名"
                        title="取消"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveClass(c.id)}
                        disabled={isRolling}
                        aria-current={active ? 'true' : undefined}
                        title={active ? '当前班级' : `切换到 ${c.name} 班`}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <School
                          className={cn(
                            'h-4 w-4 shrink-0',
                            active ? 'text-accent' : 'text-muted-foreground',
                          )}
                          aria-hidden="true"
                        />
                        <span
                          className={cn(
                            'truncate text-sm font-medium',
                            active ? 'text-accent' : 'text-foreground',
                          )}
                        >
                          {c.name} 班
                        </span>
                        <span className="tabular shrink-0 text-xs text-muted-foreground">
                          {c.students.length} 人
                        </span>
                        {active && (
                          <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                            当前
                          </span>
                        )}
                      </button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setEditing({ id: c.id, name: c.name })}
                        aria-label={`重命名 ${c.name} 班`}
                        title="重命名"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>

                      <Button
                        variant={confirmId === c.id ? 'danger' : 'ghost'}
                        size="icon"
                        className={cn('h-8 w-8 shrink-0', confirmId === c.id && 'w-auto px-2')}
                        onClick={() => handleRemove(c.id)}
                        aria-label={
                          confirmId === c.id ? `确认删除 ${c.name} 班` : `删除 ${c.name} 班`
                        }
                        title={
                          classes.length <= 1 ? '至少保留一个班级' : '删除班级及其点名记录'
                        }
                        disabled={classes.length <= 1}
                      >
                        {confirmId === c.id ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="text-[11px]">确认删除？</span>
                          </>
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </Button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="mt-3 flex gap-2">
            <input
              id="class-manager-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
              placeholder="新班级名称，如 2504"
              aria-label="新班级名称"
              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm transition-colors duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button variant="outline" size="sm" onClick={handleCreate} disabled={!newName.trim()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              新建班级
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            新建后可以为空班，随后在右侧粘贴名单即可
          </p>
        </div>

        {/* 右：粘贴名单批量导入 */}
        <div>
          <h3 className="mb-2 text-xs text-muted-foreground">批量导入名单</h3>

          <textarea
            value={rosterText}
            onChange={(e) => setRosterText(e.target.value)}
            rows={7}
            spellCheck={false}
            placeholder={
              '直接粘贴表格文本，一行一个学生，例如：\n序号,姓名,班级,性别\n1,张茜,2503,女\n2,李永嘉,2503,男\n\n不带班级列时，名单会导入当前班级'
            }
            aria-label="粘贴学生名单"
            className="w-full resize-y rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed transition-colors duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="accent"
              size="sm"
              onClick={handleApplyRoster}
              disabled={!preview || preview.length === 0}
            >
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
              {preview && preview.length > 1
                ? `导入 ${preview.length} 个班（${previewTotal} 人）`
                : preview
                  ? `导入 ${previewTotal} 人`
                  : '导入名单'}
            </Button>
            {rosterText.trim() && (
              <Button variant="ghost" size="sm" onClick={() => setRosterText('')}>
                清空
              </Button>
            )}
          </div>

          {rosterText.trim() && (!preview || preview.length === 0) && (
            <p className="mt-2 text-xs text-absent">
              没识别出学生姓名，请确认每行至少有一个姓名（中文或字母）
            </p>
          )}

          {preview && preview.length > 0 && (
            <div className="mt-3 rounded-md border border-border bg-background p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                识别到 {preview.length} 个班级、共 {previewTotal} 人
              </div>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {preview.map((p) => (
                  <li key={p.className || 'current'} className="flex items-baseline gap-2 text-xs">
                    <span className="shrink-0 font-medium text-foreground">
                      {p.className ? `${p.className} 班` : `当前班级（${activeClass?.name ?? '—'}）`}
                    </span>
                    <span className="tabular shrink-0 text-muted-foreground">
                      {p.students.length} 人
                    </span>
                    <span className="truncate text-muted-foreground/80">
                      {p.students.slice(0, 8).map((s) => s.name).join('、')}
                      {p.students.length > 8 ? ' …' : ''}
                    </span>
                  </li>
                ))}
              </ul>
              {noClassColumn && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  未识别到班级列，将导入到当前班级（{activeClass?.name ?? '—'}）
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
