import { getCurrentBusinessState, getOrganizationTypes } from "@/features/organization-application/model/actions";
import { OrganizationApplicationForm } from "@/features/organization-application/ui/organization-application-form";
import {
  editableApplicationStatuses,
  organizationApplicationStatusLabels
} from "@/entities/organization-application/model/types";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { LinkButton } from "@/shared/ui/button";
import { SectionHeader } from "@/shared/ui/section-header";

export default async function OrganizationApplicationPage() {
  const [state, categories] = await Promise.all([
    getCurrentBusinessState(),
    getOrganizationTypes()
  ]);

  if (!state) {
    return null;
  }

  const application = state.application;
  const readOnly = application ? !editableApplicationStatuses.includes(application.status) : false;

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader
        as="h1"
        title="Заявка организации"
        description="Заполните данные, которые помогут администратору проверить организацию."
        action={
          <LinkButton href="/business" variant="outline" size="sm">
            Назад
          </LinkButton>
        }
      />
      {application ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-foreground-muted">Текущий статус</p>
              <p className="font-medium">{application.organization_name ?? "Заявка организации"}</p>
            </div>
            <Badge variant={application.status === "rejected" ? "error" : application.status === "needs_changes" ? "warning" : "info"}>
              {organizationApplicationStatusLabels[application.status]}
            </Badge>
          </CardContent>
        </Card>
      ) : null}
      {application?.admin_comment ? (
        <Card>
          <CardContent>
            <p className="text-sm font-medium">Комментарий администратора</p>
            <p className="mt-2 text-sm leading-6 text-foreground-muted">{application.admin_comment}</p>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent>
          <OrganizationApplicationForm
            application={application}
            categories={categories}
            readOnly={readOnly}
          />
        </CardContent>
      </Card>
    </div>
  );
}
