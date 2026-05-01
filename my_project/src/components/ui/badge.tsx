import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 focus:ring-offset-slate-900",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-purple-600/20 text-purple-300 hover:bg-purple-600/30",
        secondary:
          "border-transparent bg-slate-700/50 text-slate-300 hover:bg-slate-700",
        destructive:
          "border-transparent bg-red-600/20 text-red-300 hover:bg-red-600/30",
        outline:
          "text-slate-300 border-slate-700",
        success:
          "border-transparent bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30",
        warning:
          "border-transparent bg-amber-600/20 text-amber-300 hover:bg-amber-600/30",
        info:
          "border-transparent bg-blue-600/20 text-blue-300 hover:bg-blue-600/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
