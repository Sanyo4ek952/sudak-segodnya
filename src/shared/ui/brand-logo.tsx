import Image from "next/image";
import { cn } from "@/shared/lib/cn";

export type BrandLogoVariant = "full" | "mark";
export type BrandLogoSize = "sm" | "md";

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  className?: string;
};

const markSizes: Record<BrandLogoSize, number> = {
  sm: 30,
  md: 40
};

export function BrandLogo({ variant = "full", size = "sm", className }: BrandLogoProps) {
  const markSize = markSizes[size];

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <Image
        src="/brand/logo-mark.png"
        alt={variant === "mark" ? "Судак Сегодня" : ""}
        aria-hidden={variant === "full" ? "true" : undefined}
        width={markSize}
        height={markSize}
        className="shrink-0"
      />
      {variant === "full" ? (
        <span
          className={cn(
            "truncate font-semibold tracking-[-0.01em] text-primary",
            size === "md" ? "text-lg" : "text-base"
          )}
        >
          Судак Сегодня
        </span>
      ) : null}
    </span>
  );
}
