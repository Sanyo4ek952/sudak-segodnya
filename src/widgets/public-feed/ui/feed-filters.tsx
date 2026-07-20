"use client";

import { filterItems } from "@/entities/publication/model/mock";
import type { PublicationFilter } from "@/entities/publication/model/types";
import { cn } from "@/shared/lib/cn";

type FeedFiltersProps = {
  value: PublicationFilter;
  onChange: (value: PublicationFilter) => void;
};

export function FeedFilters({ value, onChange }: FeedFiltersProps) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Фильтры ленты">
      <div className="flex w-max gap-2 pb-1">
        {filterItems.map((item) => (
          <button
            key={item.value}
            type="button"
            className={cn(
              "min-h-10 rounded-full border border-border bg-surface px-4 text-sm font-medium text-foreground-muted transition",
              value === item.value && "border-primary bg-primary text-primary-foreground"
            )}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
