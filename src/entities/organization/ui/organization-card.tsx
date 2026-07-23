import { AnalyticsLink } from "@/features/analytics/ui/analytics-link";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { FavoriteToggle } from "@/features/save-favorite/ui/favorite-toggle";
import type { Organization } from "@/entities/organization/model/types";
import { organizationTypeLabels } from "@/entities/organization/model/types";
import { OrganizationImage } from "@/entities/organization/ui/organization-image";

export function OrganizationCard({ organization }: { organization: Organization }) {
  return (
    <Card className="overflow-hidden">
      <AnalyticsLink
        href={`/organizations/${organization.slug}`}
        className="block"
        analytics={{ eventName: "organization_click", organizationId: organization.id }}
      >
        <OrganizationImage organization={organization} className="aspect-[16/9] w-full rounded-none" />
      </AnalyticsLink>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
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
        <div className="space-y-2">
          <AnalyticsLink
            href={`/organizations/${organization.slug}`}
            className="block"
            analytics={{ eventName: "organization_click", organizationId: organization.id }}
          >
            <h3 className="text-lg font-semibold leading-snug">{organization.name}</h3>
          </AnalyticsLink>
          <p className="line-clamp-2 text-sm leading-6 text-foreground-muted">{organization.description}</p>
        </div>
        <div className="grid gap-2 text-sm text-foreground-muted">
          <p>{organization.address}</p>
          <p>{organization.workingHours}</p>
          {organization.activePublicationIds.length ? (
            <p className="font-medium text-foreground">{organization.activePublicationIds.length} активные публикации</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
