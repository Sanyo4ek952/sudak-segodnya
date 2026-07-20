import Image from "next/image";
import { cn } from "@/shared/lib/cn";
import type { Organization } from "@/entities/organization/model/types";

type OrganizationImageProps = {
  organization: Organization;
  className?: string;
  priority?: boolean;
};

export function OrganizationImage({ organization, className, priority = false }: OrganizationImageProps) {
  const image = organization.logo ?? organization.cover;

  if (image) {
    return (
      <div className={cn("relative overflow-hidden rounded-lg bg-surface-muted", className)}>
        <Image
          src={image}
          alt=""
          fill
          className="object-cover"
          sizes="(min-width: 768px) 260px, 100vw"
          priority={priority}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center rounded-lg bg-surface-muted text-2xl font-semibold text-primary", className)}>
      {organization.name.slice(0, 1)}
    </div>
  );
}
