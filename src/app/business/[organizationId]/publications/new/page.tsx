import { randomUUID } from "node:crypto";
import {
  getBusinessOrganization,
  getPublicationCategories
} from "@/features/business-cabinet/model/actions";
import { PublicationForm } from "@/features/business-cabinet/ui/publication-form";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";
import { notFound } from "next/navigation";

type NewPublicationPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function NewPublicationPage({ params }: NewPublicationPageProps) {
  const { organizationId } = await params;
  const [categories, organization] = await Promise.all([
    getPublicationCategories(),
    getBusinessOrganization(organizationId)
  ]);

  if (!organization) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader as="h1" title="Новая публикация" description="Заполните основные данные материала." />
      <Card>
        <CardContent>
          <PublicationForm
            organizationId={organizationId}
            organizationAddress={organization.address}
            categories={categories}
            draftPublicationId={randomUUID()}
            clientRequestId={randomUUID()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
