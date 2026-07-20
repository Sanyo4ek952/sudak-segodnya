"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/cn";
import { AppBottomNavigation } from "@/widgets/app-shell/ui/app-bottom-navigation";
import { AppTopBar } from "@/widgets/app-shell/ui/app-top-bar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const hasBottomNavigation = !pathname.startsWith("/admin");

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <AppTopBar />
      <main
        className={cn(
          "mx-auto w-full max-w-content flex-1 px-4 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-6",
          hasBottomNavigation
            ? "pb-[calc(7rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        )}
      >
        {children}
      </main>
      <AppBottomNavigation />
    </div>
  );
}
