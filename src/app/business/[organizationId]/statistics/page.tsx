import { notFound } from "next/navigation";
import { getBusinessAnalyticsSummary } from "@/features/business-cabinet/model/actions";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

type StatisticsPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function StatisticsPage({ params }: StatisticsPageProps) {
  const { organizationId } = await params;
  const analytics = await getBusinessAnalyticsSummary(organizationId);

  if (!analytics) {
    notFound();
  }

  const metrics = [
    { label: "Просмотры организации", value: analytics.organizationViews },
    { label: "Просмотры публикаций", value: analytics.publicationViews },
    { label: "Звонки", value: analytics.phoneClicks },
    { label: "Маршруты", value: analytics.routeClicks },
    { label: "Открытия меню", value: analytics.menuOpens },
    { label: "Добавления в избранное", value: analytics.favoriteAdds }
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Статистика"
        description="Базовые события MVP без сложной аналитики и персональных данных."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent>
              <p className="text-sm text-foreground-muted">{metric.label}</p>
              <p className="mt-2 text-3xl font-semibold">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
