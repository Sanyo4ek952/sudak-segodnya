import type { SelectHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-surface-muted/55 disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}
