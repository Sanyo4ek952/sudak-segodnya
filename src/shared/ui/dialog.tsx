"use client";

import type { ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
  className?: string;
};

export function Dialog({
  open,
  title,
  description,
  children,
  onOpenChange,
  className
}: DialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 px-0 sm:items-center sm:px-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Закрыть"
        onClick={() => onOpenChange(false)}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        className={cn(
          "relative w-full rounded-t-xl border border-border bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-popover sm:max-w-form sm:rounded-lg sm:p-5",
          className
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h2 id="app-dialog-title" className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="text-sm leading-6 text-foreground-muted">{description}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => onOpenChange(false)}
          >
            Закрыть
          </Button>
        </div>
        {children}
      </section>
    </div>
  );
}
