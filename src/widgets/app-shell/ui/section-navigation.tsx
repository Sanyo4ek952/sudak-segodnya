"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/cn";

export type SectionNavigationItem = {
  label: string;
  href: string;
  exact?: boolean;
};

type SectionNavigationProps = {
  label: string;
  items: SectionNavigationItem[];
  variant?: "tabs" | "workspace";
};

export function SectionNavigation({ label, items, variant = "tabs" }: SectionNavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        variant === "workspace" && "lg:overflow-visible lg:pb-0"
      )}
      aria-label={label}
    >
      <div
        className={cn(
          "flex gap-2",
          variant === "workspace" ? "w-max lg:w-full lg:flex-col" : "min-w-0"
        )}
      >
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
                "flex min-h-10 shrink-0 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground-muted transition-colors hover:border-primary/25 hover:bg-background hover:text-primary",
                variant === "workspace" && "lg:w-full lg:justify-start lg:border-transparent lg:bg-transparent",
                isActive && "border-primary/25 bg-primary/5 text-primary"
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
