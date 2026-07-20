import { getAdminApplicationSummary } from "@/features/admin-application-review/model/actions";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

export default async function AdminPage() {
  const summary = await getAdminApplicationSummary();

  return (
    <div className="mx-auto max-w-content space-y-6">
      <SectionHeader
        as="h1"
        title="Администрирование"
        description="Минимальная панель рассмотрения заявок организаций."
        action={
          <LinkButton href="/admin/applications" variant="outline" size="sm">
            Заявки
          </LinkButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm leading-6 text-foreground-muted">На рассмотрении</p>
            <p className="text-4xl font-semibold">{summary.submitted}</p>
            <LinkButton href="/admin/applications?status=submitted" variant="link">
              Открыть список
            </LinkButton>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm leading-6 text-foreground-muted">Требуют внимания</p>
            <p className="text-4xl font-semibold">{summary.needsChanges}</p>
            <LinkButton href="/admin/applications?status=needs_changes" variant="link">
              Открыть список
            </LinkButton>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
