import { AnalyticsLink } from "@/features/analytics/ui/analytics-link";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { FavoriteToggle } from "@/features/save-favorite/ui/favorite-toggle";
import type { Organization } from "@/entities/organization/model/types";
import { organizationTypeLabels } from "@/entities/organization/model/types";
import { OrganizationImage } from "@/entities/organization/ui/organization-image";

function formatActivePublications(count: number) {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  const label = modulo100 >= 11 && modulo100 <= 14
    ? "активных публикаций"
    : modulo10 === 1
      ? "активная публикация"
      : modulo10 >= 2 && modulo10 <= 4
        ? "активные публикации"
        : "активных публикаций";

  return `${count} ${label}`;
}

export function OrganizationCard({ organization }: { organization: Organization }) {
  return (
    <Card className="transition-shadow hover:shadow-popover">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <AnalyticsLink
            href={`/organizations/${organization.slug}`}
            className="shrink-0 rounded-lg"
            analytics={{ eventName: "organization_click", organizationId: organization.id }}
          >
            <OrganizationImage organization={organization} className="size-20 sm:size-24" />
          </AnalyticsLink>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <Badge variant="muted">{organizationTypeLabels[organization.type]}</Badge>
              <FavoriteToggle
                id={organization.id}
                type="organization"
                label={organization.name}
                analytics={{
                  organizationId: organization.id
                }}
              />
            </div>
            <AnalyticsLink
              href={`/organizations/${organization.slug}`}
              className="block"
              analytics={{ eventName: "organization_click", organizationId: organization.id }}
            >
              <h3 className="text-base font-semibold leading-snug text-foreground sm:text-lg">
                {organization.name}
              </h3>
            </AnalyticsLink>
            <p className="line-clamp-2 text-sm leading-5 text-foreground-muted">
              {organization.description}
            </p>
            <div className="grid gap-1 text-xs leading-5 text-foreground-muted sm:text-sm">
              <p className="line-clamp-1">{organization.address}</p>
              <p className="line-clamp-1">{organization.workingHours}</p>
              {organization.activePublicationIds.length ? (
                <p className="font-medium text-primary">
                  {formatActivePublications(organization.activePublicationIds.length)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
