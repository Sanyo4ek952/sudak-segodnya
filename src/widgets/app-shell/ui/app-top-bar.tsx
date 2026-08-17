"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isWorkspacePath, publicNavigationItems } from "@/shared/config/navigation";
import { cn } from "@/shared/lib/cn";
import { BrandLogo } from "@/shared/ui/brand-logo";

export function AppTopBar() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isBusiness = pathname.startsWith("/business");
  const isWorkspace = isWorkspacePath(pathname);

  return (
    <header
      className="sticky top-0 z-30 border-b border-border/80 bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur"
    >
      <div
        className={cn(
          "mx-auto flex min-h-14 items-center justify-between gap-4 px-4 sm:min-h-16 sm:px-6 lg:px-8",
          isWorkspace ? "max-w-dashboard" : "max-w-content"
        )}
      >
        <Link href="/" className="min-w-0 rounded-md" aria-label="Судак Сегодня — на главную">
          <BrandLogo />
        </Link>
        {isAdmin || isBusiness ? (
          <p className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-primary">
            {isAdmin ? "Админ" : "Для бизнеса"}
          </p>
        ) : (
          <nav className="hidden items-center gap-1 md:flex" aria-label="Основная навигация">
            {publicNavigationItems.map((item) => {
              const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted/45 hover:text-primary",
                    isActive && "bg-primary/5 text-primary"
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
