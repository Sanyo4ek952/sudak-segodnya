import type { ReactNode } from "react";
import {
  SectionNavigation,
  type SectionNavigationItem
} from "@/widgets/app-shell/ui/section-navigation";

type WorkspaceShellProps = {
  navigationLabel: string;
  navigationItems: SectionNavigationItem[];
  children: ReactNode;
};

export function WorkspaceShell({
  navigationLabel,
  navigationItems,
  children
}: WorkspaceShellProps) {
  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <aside className="sticky top-24 hidden rounded-xl border border-border/90 bg-surface p-4 shadow-card lg:block">
        <SectionNavigation
          label={navigationLabel}
          items={navigationItems}
          variant="workspace"
        />
      </aside>
      <div className="min-w-0 space-y-6">
        <div className="lg:hidden">
          <SectionNavigation
            label={navigationLabel}
            items={navigationItems}
            variant="workspace"
          />
        </div>
        {children}
      </div>
    </div>
  );
}
