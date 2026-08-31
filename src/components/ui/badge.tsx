import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-blue-600/20 text-blue-400 border border-blue-500/30",
        secondary:
          "border-transparent bg-[#162444] text-slate-300 border border-[#182645]",
        destructive:
          "border-transparent bg-red-500/20 text-red-400 border border-red-500/30",
        outline: "text-slate-300 border border-[#182645]",
        gold: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
        silver: "bg-slate-400/20 text-slate-200 border border-slate-400/40",
        bronze: "bg-amber-700/20 text-amber-400 border border-amber-600/40",
        live: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
