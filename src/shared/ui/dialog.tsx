"use client";

import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef
} from "react";
import { Button } from "@/shared/ui/button";

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

type DialogProps = {
  open?: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  variant?: "default" | "viewer";
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

export function Dialog({
  open = true,
  title,
  description,
  children,
  onClose,
  onOpenChange,
  className,
  variant = "default"
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const requestClose = useCallback(() => {
    onClose?.();
    onOpenChange?.(false);
  }, [onClose, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const initialTarget = panel?.querySelector<HTMLElement>(focusableSelector) ?? panel;
    initialTarget?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const targets = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((target) => !target.hidden && target.getAttribute("aria-hidden") !== "true");
      if (targets.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open, requestClose]);

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) requestClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4"
      onMouseDown={closeFromBackdrop}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full overflow-y-auto bg-background shadow-xl outline-none",
          "pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]",
          variant === "viewer"
            ? "h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-5xl sm:rounded-2xl"
            : "max-h-[calc(100dvh-env(safe-area-inset-top))] rounded-t-2xl px-5 sm:max-w-lg sm:rounded-2xl",
          className
        )}
      >
        <div className={cn(
          "flex items-center justify-between gap-4",
          variant === "viewer" ? "px-4 sm:px-5" : ""
        )}>
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={requestClose} aria-label="Закрыть окно">
            <span aria-hidden="true" className="text-2xl leading-none">×</span>
          </Button>
        </div>
        {description ? <p id={descriptionId} className={cn("mt-2 text-sm text-muted-foreground", variant === "viewer" && "px-4 sm:px-5")}>{description}</p> : null}
        <div className={cn("mt-4", variant === "viewer" && "px-4 pb-4 sm:px-5")}>{children}</div>
      </div>
    </div>
  );
}
