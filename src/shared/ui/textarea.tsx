import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm leading-6 text-foreground transition placeholder:text-foreground-muted focus:border-primary disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}
