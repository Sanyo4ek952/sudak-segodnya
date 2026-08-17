import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "muted"
  | "accent"
  | "sand"
  | "coral";

const variants: Record<BadgeVariant, string> = {
  default: "border-primary bg-primary text-primary-foreground",
  success: "border-success/20 bg-success/5 text-success",
  warning: "border-sand bg-sand/30 text-warning",
  error: "border-coral/40 bg-coral/10 text-error",
  info: "border-accent-light bg-accent-light/35 text-primary-600",
  muted: "border-border/70 bg-surface-muted/50 text-foreground-muted",
  accent: "border-accent/25 bg-accent-light/40 text-primary",
  sand: "border-sand bg-sand text-foreground",
  coral: "border-coral/40 bg-coral/10 text-error"
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex min-h-6 items-center rounded-full border px-2.5 text-xs font-medium", variants[variant], className)}
      {...props}
    />
  );
}
