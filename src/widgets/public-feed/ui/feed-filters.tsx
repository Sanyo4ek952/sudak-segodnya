import Link from "next/link";
import { filterItems } from "@/entities/publication/model/filters";
import type { PublicationFilter } from "@/entities/publication/model/types";
import { cn } from "@/shared/lib/cn";

type FeedFiltersProps = {
  value: PublicationFilter;
};

export function getFeedFilterClassName(isActive: boolean) {
  return cn(
    "inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    isActive
      ? "border-primary bg-primary text-primary-foreground hover:opacity-95"
      : "border-border bg-surface text-foreground-muted hover:bg-surface-muted hover:text-foreground"
  );
}

export function FeedFilters({ value }: FeedFiltersProps) {
  return (
    <nav
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
      aria-label="Фильтры ленты"
    >
      <div className="flex w-max gap-2 pb-1">
        {filterItems.map((item) => {
          const isActive = value === item.value;

          return (
            <Link
              key={item.value}
              href={item.value === "all" ? "/" : `/?filter=${item.value}`}
              aria-current={isActive ? "page" : undefined}
              className={getFeedFilterClassName(isActive)}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
