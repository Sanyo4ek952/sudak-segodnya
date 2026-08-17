"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { publicNavigationItems, type PublicNavigationIcon } from "@/shared/config/navigation";
import { cn } from "@/shared/lib/cn";

function NavigationIcon({ name }: { name: PublicNavigationIcon }) {
  if (name === "feed") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3.5 10.5 12 3l8.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "catalog") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }

  if (name === "favorites") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20.8 8.6c0 5.3-8.8 10.3-8.8 10.3S3.2 13.9 3.2 8.6A4.8 4.8 0 0 1 12 5.9a4.8 4.8 0 0 1 8.8 2.7Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8.5h16V21H4z" strokeLinejoin="round" />
      <path d="M8 8.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2.5M4 13h16M10 13v2h4v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AppBottomNavigation() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-surface/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-popover backdrop-blur md:hidden"
      aria-label="Нижняя навигация"
    >
      <div className="mx-auto grid max-w-form grid-cols-4 gap-1">
        {publicNavigationItems.map((item) => {
          const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-2 text-center text-xs font-medium leading-3 text-foreground-muted transition-colors",
                isActive && "text-primary"
              )}
            >
              <NavigationIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
