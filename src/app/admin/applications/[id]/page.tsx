import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ApplicationReviewActions } from "@/features/admin-application-review/ui/application-review-actions";
import { getAdminApplication } from "@/features/admin-application-review/model/actions";
import {
  getOrganizationApplicationStatusVariant,
  organizationApplicationStatusLabels
} from "@/entities/organization-application/model/types";
import { formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

type AdminApplicationPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-foreground-muted">{label}</dt>
      <dd className="text-sm leading-6 text-foreground">{value || "Не указано"}</dd>
    </div>
  );
}

export default async function AdminApplicationPage({
  params
}: AdminApplicationPageProps) {
  const { id } = await params;
  const application = await getAdminApplication(id);

  if (!application) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader
        as="h1"
        title={application.organization_name ?? "Заявка организации"}
        description="Проверка данных организации и действия администратора."
        action={
          <LinkButton href="/admin/applications" variant="outline" size="sm">
            К списку
          </LinkButton>
        }
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-foreground-muted">Текущий статус</p>
              <p className="font-medium">{organizationApplicationStatusLabels[application.status]}</p>
            </div>
            <Badge variant={getOrganizationApplicationStatusVariant(application.status)}>
              {organizationApplicationStatusLabels[application.status]}
            </Badge>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Категория" value={application.organization_categories?.name ?? application.category_name} />
            <DetailRow label="Телефон" value={application.phone} />
            <DetailRow label="Адрес" value={application.address} />
            <DetailRow label="Заявитель" value={application.applicant?.display_name ?? application.applicant_id} />
            <DetailRow label="Телефон профиля заявителя" value={application.applicant?.phone} />
            <DetailRow label="Связь с организацией" value={application.relationship} />
            <DetailRow label="Создана" value={formatDateTime(application.created_at)} />
            <DetailRow label="Обновлена" value={formatDateTime(application.updated_at)} />
            <DetailRow
              label="Подана"
              value={application.submitted_at ? formatDateTime(application.submitted_at) : "Не отправлена"}
            />
            <DetailRow
              label="Рассмотрена"
              value={application.reviewed_at ? formatDateTime(application.reviewed_at) : "Еще не рассмотрена"}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-lg font-semibold">Описание</h2>
          <p className="text-sm leading-6 text-foreground-muted">
            {application.description ?? "Описание не указано."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-lg font-semibold">Подтверждающая информация</h2>
          <p className="text-sm leading-6 text-foreground-muted">
            {application.confirmation_info ?? "Подтверждающая информация не указана."}
          </p>
        </CardContent>
      </Card>

      {application.admin_comment ? (
        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-lg font-semibold">Комментарий администратора</h2>
            <p className="text-sm leading-6 text-foreground-muted">{application.admin_comment}</p>
          </CardContent>
        </Card>
      ) : null}

      {application.organizations ? (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-lg font-semibold">Связанная организация</h2>
            <p className="text-sm leading-6 text-foreground-muted">
              {application.organizations.name} · {application.organizations.status}
            </p>
            <LinkButton href={`/organizations/${application.organizations.slug}`} variant="outline" size="sm">
              Открыть публичную страницу
            </LinkButton>
          </CardContent>
        </Card>
      ) : null}

      <ApplicationReviewActions applicationId={application.id} status={application.status} />
    </div>
  );
}
