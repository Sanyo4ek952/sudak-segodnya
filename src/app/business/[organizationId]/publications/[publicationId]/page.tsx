import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PublicationMediaEditorServer } from "@/features/business-cabinet/ui/publication-media-editor-server";
import {
  getBusinessOrganization,
  getBusinessPublication,
  getPublicationCategories,
  saveBusinessPublicationAction
} from "@/features/business-cabinet/model/actions";
import { PublicationForm } from "@/features/business-cabinet/ui/publication-form";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

type EditPublicationPageProps = {
  params: Promise<{
    organizationId: string;
    publicationId: string;
  }>;
};

export default async function EditPublicationPage({ params }: EditPublicationPageProps) {
  const { organizationId, publicationId } = await params;
  const [publication, categories, organization] = await Promise.all([
    getBusinessPublication(organizationId, publicationId),
    getPublicationCategories(),
    getBusinessOrganization(organizationId)
  ]);

  if (!publication || !organization) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader
        as="h1"
        title="Редактирование публикации"
        description="Измените содержание, проверьте предпросмотр и сохраните."
      />
      <Card>
        <CardContent>
      <PublicationMediaEditorServer publicationId={publication.id} />
      <PublicationForm
            organizationId={organizationId}
            organizationAddress={organization.address}
            publication={publication}
            categories={categories}
            draftPublicationId={publication.id}
            clientRequestId={publication.client_request_id ?? randomUUID()}
            saveAction={saveBusinessPublicationAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}
