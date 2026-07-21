import { notFound } from "next/navigation";
import { getBusinessOverview } from "@/features/business-cabinet/model/actions";
import { businessPublicationStatusLabels } from "@/features/business-cabinet/model/types";
import { Badge } from "@/shared/ui/badge";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";
import { formatDateTime } from "@/shared/lib/date";

type BusinessOrganizationPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function BusinessOrganizationPage({ params }: BusinessOrganizationPageProps) {
  const { organizationId } = await params;
  const overview = await getBusinessOverview(organizationId);

  if (!overview) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title={overview.organization.name}
        description="Краткий обзор организации, публикаций и меню."
        action={<LinkButton href={`/organizations/${overview.organization.slug}`} variant="outline" size="sm">Публичная страница</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-foreground-muted">Статус</p>
            <Badge variant="success">Активна</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-foreground-muted">Активные публикации</p>
            <p className="mt-2 text-3xl font-semibold">{overview.activePublications}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-foreground-muted">Доступные позиции меню</p>
            <p className="mt-2 text-3xl font-semibold">{overview.menuItems}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Ближайшие публикации</h2>
            <LinkButton href={`/business/${organizationId}/publications/new`} variant="primary" size="sm">
              Создать
            </LinkButton>
          </div>
          {overview.upcomingPublications.length ? (
            <div className="grid gap-3">
              {overview.upcomingPublications.map((publication) => (
                <div key={publication.id} className="rounded-md border border-border bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{publication.title}</p>
                    <Badge variant="info">{businessPublicationStatusLabels[publication.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {publication.starts_at ? formatDateTime(publication.starts_at) : "Дата не указана"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-foreground-muted">Ближайших публикаций пока нет.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
