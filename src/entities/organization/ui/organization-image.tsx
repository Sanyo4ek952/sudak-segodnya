import Image from "next/image";
import { cn } from "@/shared/lib/cn";
import type { Organization } from "@/entities/organization/model/types";

type OrganizationImageProps = {
  organization: Pick<Organization, "name" | "logo" | "cover">;
  className?: string;
  priority?: boolean;
  shape?: "rounded" | "circle";
};

export function OrganizationImage({
  organization,
  className,
  priority = false,
  shape = "rounded"
}: OrganizationImageProps) {
  const image = organization.logo ?? organization.cover;
  const shapeClassName = shape === "circle" ? "rounded-full" : "rounded-lg";
  const sizes = shape === "circle" ? "36px" : "(min-width: 768px) 260px, 100vw";

  if (image) {
    return (
      <div className={cn("relative overflow-hidden bg-surface-muted", shapeClassName, className)}>
        <Image
          src={image}
          alt=""
          fill
          unoptimized
          className={organization.logo ? "object-contain p-2" : "object-cover"}
          sizes={sizes}
          priority={priority}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center bg-surface-muted/65 text-2xl font-semibold text-primary", shapeClassName, className)}>
      {organization.name.slice(0, 1)}
    </div>
  );
}
