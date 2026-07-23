"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/cn";

type SectionNavigationItem = {
  label: string;
  href: string;
  exact?: boolean;
};

type SectionNavigationProps = {
  label: string;
  items: SectionNavigationItem[];
};

export function SectionNavigation({ label, items }: SectionNavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={label}
    >
      <div className="flex min-w-0 gap-2">
        {items.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : item.href === pathname || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                "flex min-h-10 shrink-0 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground-muted",
                isActive && "border-primary bg-surface-muted text-foreground"
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
