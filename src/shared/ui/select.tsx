import type { SelectHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground transition focus:border-primary disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}
