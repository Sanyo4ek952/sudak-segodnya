import type { ReactNode } from "react";

type SectionHeaderProps = {
  as?: "h1" | "h2";
  title: string;
  description?: string;
  action?: ReactNode;
};

export function SectionHeader({ as = "h2", title, description, action }: SectionHeaderProps) {
  const Title = as;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <Title className="text-xl font-semibold tracking-normal text-foreground">{title}</Title>
        {description ? <p className="text-sm leading-6 text-foreground-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
