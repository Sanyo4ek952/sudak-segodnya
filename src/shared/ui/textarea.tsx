import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm leading-6 text-foreground transition placeholder:text-foreground-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-surface-muted/55 disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}
