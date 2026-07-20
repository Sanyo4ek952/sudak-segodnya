"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { publicNavigationItems } from "@/shared/config/navigation";
import { cn } from "@/shared/lib/cn";

export function AppBottomNavigation() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-popover md:hidden"
      aria-label="Нижняя навигация"
    >
      <div className="mx-auto grid max-w-form grid-cols-4 gap-1">
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
  );
}
