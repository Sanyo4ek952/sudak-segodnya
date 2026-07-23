import { notFound } from "next/navigation";
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

type OrganizationApplicationPageProps = {
  searchParams: Promise<{
    id?: string | string[];
    new?: string | string[];
  }>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OrganizationApplicationPage({
  searchParams
}: OrganizationApplicationPageProps) {
  const params = await searchParams;
  const [state, categories] = await Promise.all([
    getCurrentBusinessState(),
    getOrganizationTypes()
  ]);

  if (!state) {
    return null;
  }

  const requestedId = single(params.id);
  const isNew = single(params.new) === "1";
  const application = isNew
    ? null
    : requestedId
      ? state.applications.find((item) => item.id === requestedId) ?? null
      : state.application;

  if (requestedId && !application) {
    notFound();
  }

  const readOnly = application ? !editableApplicationStatuses.includes(application.status) : false;

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader
        as="h1"
        title="Заявка на добавление организации"
        description="Каждая новая организация оформляется отдельной заявкой."
        action={
          <LinkButton href="/business" variant="outline" size="sm">
            К моим организациям
          </LinkButton>
        }
      />
      {application ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-foreground-muted">Текущий статус</p>
              <p className="font-medium">{application.organization_name ?? "Заявка на добавление организации"}</p>
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
            key={application?.id ?? "new"}
            application={application}
            categories={categories}
            readOnly={readOnly}
          />
        </CardContent>
      </Card>
    </div>
  );
}
