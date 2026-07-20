import { notFound } from "next/navigation";
import {
  changePublicationStatusAction,
  deleteDraftPublicationAction,
  getBusinessPublications
} from "@/features/business-cabinet/model/actions";
import {
  businessPublicationStatusLabels,
  businessPublicationTypeLabels
} from "@/features/business-cabinet/model/types";
import { Badge } from "@/shared/ui/badge";
import { Button, LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeader } from "@/shared/ui/section-header";
import { formatDateTime } from "@/shared/lib/date";

type PublicationsPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

function statusVariant(status: string) {
  if (status === "published") return "success";
  if (status === "cancelled" || status === "blocked") return "error";
  if (status === "scheduled" || status === "moderation") return "warning";
  return "info";
}

export default async function PublicationsPage({ params }: PublicationsPageProps) {
  const { organizationId } = await params;
  const publications = await getBusinessPublications(organizationId);

  if (!publications) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Публикации"
        description="Черновики, запланированные и опубликованные материалы организации."
        action={<LinkButton href={`/business/${organizationId}/publications/new`} size="sm">Создать</LinkButton>}
      />

      {publications.length ? (
        <div className="grid gap-4">
          {publications.map((publication) => (
            <Card key={publication.id}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={statusVariant(publication.status)}>
                        {businessPublicationStatusLabels[publication.status]}
                      </Badge>
                      <Badge variant="muted">{businessPublicationTypeLabels[publication.type]}</Badge>
                    </div>
                    <h2 className="text-lg font-semibold">{publication.title}</h2>
                  </div>
                  <LinkButton href={`/business/${organizationId}/publications/${publication.id}`} variant="outline" size="sm">
                    Редактировать
                  </LinkButton>
                </div>
                <p className="line-clamp-2 text-sm leading-6 text-foreground-muted">{publication.description}</p>
                <p className="text-sm text-foreground-muted">
                  {publication.starts_at ? formatDateTime(publication.starts_at) : "Дата не указана"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {publication.status === "published" || publication.status === "scheduled" ? (
                    <form action={changePublicationStatusAction}>
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="publicationId" value={publication.id} />
                      <input type="hidden" name="status" value="cancelled" />
                      <Button type="submit" variant="outline" size="sm">Отменить</Button>
                    </form>
                  ) : null}
                  {publication.status === "published" || publication.status === "scheduled" || publication.status === "cancelled" ? (
                    <form action={changePublicationStatusAction}>
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="publicationId" value={publication.id} />
                      <input type="hidden" name="status" value="completed" />
                      <Button type="submit" variant="outline" size="sm">Завершить</Button>
                    </form>
                  ) : null}
                  {publication.status === "draft" ? (
                    <form action={deleteDraftPublicationAction}>
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="publicationId" value={publication.id} />
                      <Button type="submit" variant="destructive" size="sm">Удалить черновик</Button>
                    </form>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Публикаций пока нет"
          description="Создайте первый черновик, чтобы подготовить материал для городской ленты."
          actionLabel="Создать публикацию"
          actionHref={`/business/${organizationId}/publications/new`}
        />
      )}
    </div>
  );
}
