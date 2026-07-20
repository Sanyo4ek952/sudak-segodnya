import type { InputHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground transition placeholder:text-foreground-muted focus:border-primary disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}
