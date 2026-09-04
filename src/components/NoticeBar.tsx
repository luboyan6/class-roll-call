import { AnimatePresence, motion } from 'framer-motion'
import { Info, X } from 'lucide-react'
import { useRollCallStore } from '@/store/rollCallStore'

export function NoticeBar() {
  const notice = useRollCallStore((s) => s.notice)
  const clearNotice = useRollCallStore((s) => s.clearNotice)

  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          role="status"
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted px-4 py-3 text-sm"
        >
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {notice}
          </span>
          <button
            type="button"
            onClick={clearNotice}
            aria-label="关闭提示"
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:bg-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
