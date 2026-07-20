"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { publicNavigationItems } from "@/shared/config/navigation";
import { cn } from "@/shared/lib/cn";

export function PublicNavigation() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="min-w-0 text-base font-semibold text-foreground">
          Судак Сегодня
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Основная навигация">
          {publicNavigationItems.map((item) => {
            const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium text-foreground-muted transition hover:bg-surface-muted hover:text-foreground",
                  isActive && "bg-surface-muted text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-popover md:hidden"
        aria-label="Нижняя навигация"
      >
        <div className="mx-auto grid max-w-form grid-cols-3 gap-1">
          {publicNavigationItems.map((item) => {
            const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-12 items-center justify-center rounded-md px-2 text-center text-sm font-medium text-foreground-muted",
                  isActive && "bg-surface-muted text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
