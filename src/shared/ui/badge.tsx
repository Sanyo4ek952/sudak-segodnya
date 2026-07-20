import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "muted";

const variants: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground",
  success: "bg-success text-primary-foreground",
  warning: "bg-warning text-primary-foreground",
  error: "bg-error text-primary-foreground",
  info: "bg-info text-primary-foreground",
  muted: "bg-surface-muted text-foreground"
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-medium", variants[variant], className)}
      {...props}
    />
  );
}
