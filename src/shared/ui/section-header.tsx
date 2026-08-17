import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type SectionHeaderProps = {
  as?: "h1" | "h2";
  title: string;
  description?: string;
  action?: ReactNode;
};

export function SectionHeader({ as = "h2", title, description, action }: SectionHeaderProps) {
  const Title = as;

  return (
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
      <div className="min-w-0 space-y-1">
        <Title
          className={cn(
            "font-semibold tracking-normal text-foreground",
            as === "h1" ? "text-2xl leading-tight sm:text-3xl" : "text-xl leading-7"
          )}
        >
          {title}
        </Title>
        {description ? <p className="text-sm leading-6 text-foreground-muted">{description}</p> : null}
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
    </div>
  );
}
