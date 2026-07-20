"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { publicNavigationItems } from "@/shared/config/navigation";
import { cn } from "@/shared/lib/cn";

export function AppTopBar() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-content items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="min-w-0 text-base font-semibold text-foreground">
          Судак Сегодня
        </Link>
        {isAdmin ? (
          <p className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-foreground-muted">
            Админ
          </p>
        ) : (
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
        )}
      </div>
    </header>
  );
}
