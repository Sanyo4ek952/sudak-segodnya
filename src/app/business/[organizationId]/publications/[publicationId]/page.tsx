import { notFound } from "next/navigation";
import { getBusinessPublication, getPublicationCategories } from "@/features/business-cabinet/model/actions";
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
  const [publication, categories] = await Promise.all([
    getBusinessPublication(organizationId, publicationId),
    getPublicationCategories()
  ]);

  if (!publication) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader as="h1" title="Редактирование публикации" description="Измените данные и сохраните статус." />
      <Card>
        <CardContent>
          <PublicationForm organizationId={organizationId} publication={publication} categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
