import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import {
  getAdminOrganization,
  getAdminPublication
} from "@/features/admin-quality-control/model/actions";
import {
  getPublicationCategories,
  saveAdminPublicationAction
} from "@/features/business-cabinet/model/actions";
import { PublicationForm } from "@/features/business-cabinet/ui/publication-form";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

type AdminPublicationEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminPublicationEditPage({
  params
}: AdminPublicationEditPageProps) {
  const { id } = await params;
  const [publication, categories] = await Promise.all([
    getAdminPublication(id),
    getPublicationCategories()
  ]);

  if (!publication) {
    notFound();
  }

  const organization = await getAdminOrganization(publication.organization_id);

  if (!organization) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader
        as="h1"
        title="Редактирование публикации"
        description={`Организация: ${organization.name}. Изменения записываются в историю.`}
      />
      <Card>
        <CardContent>
          <PublicationForm
            organizationId={organization.id}
            organizationAddress={organization.address}
            publication={publication}
            categories={categories}
            draftPublicationId={publication.id}
            clientRequestId={publication.client_request_id ?? randomUUID()}
            saveAction={saveAdminPublicationAction}
            isAdminEditor
          />
        </CardContent>
      </Card>
    </div>
  );
}
