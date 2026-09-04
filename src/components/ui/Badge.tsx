import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors duration-200',
  {
    variants: {
      variant: {
        default: 'border-border bg-muted text-foreground',
        present: 'border-present/30 bg-present/10 text-present',
        late: 'border-late/30 bg-late/10 text-late',
        leave: 'border-leave/30 bg-leave/10 text-leave',
        absent: 'border-absent/30 bg-absent/10 text-absent',
        outline: 'border-border text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
