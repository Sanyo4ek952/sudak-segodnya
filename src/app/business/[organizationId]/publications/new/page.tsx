import { getPublicationCategories } from "@/features/business-cabinet/model/actions";
import { PublicationForm } from "@/features/business-cabinet/ui/publication-form";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

type NewPublicationPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function NewPublicationPage({ params }: NewPublicationPageProps) {
  const { organizationId } = await params;
  const categories = await getPublicationCategories();

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader as="h1" title="Новая публикация" description="Заполните основные данные материала." />
      <Card>
        <CardContent>
          <PublicationForm organizationId={organizationId} categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
