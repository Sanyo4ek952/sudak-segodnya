import { notFound } from "next/navigation";
import { getBusinessOverview } from "@/features/business-cabinet/model/actions";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

type StatisticsPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function StatisticsPage({ params }: StatisticsPageProps) {
  const { organizationId } = await params;
  const overview = await getBusinessOverview(organizationId);

  if (!overview) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Статистика"
        description="Базовые показатели MVP без сложной аналитики."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent>
            <p className="text-sm text-foreground-muted">Активные публикации</p>
            <p className="mt-2 text-3xl font-semibold">{overview.activePublications}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-foreground-muted">Доступные позиции меню</p>
            <p className="mt-2 text-3xl font-semibold">{overview.menuItems}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
