import { notFound } from "next/navigation";
import { getBusinessMembers } from "@/features/business-cabinet/model/actions";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

type SettingsPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { organizationId } = await params;
  const members = await getBusinessMembers(organizationId);

  if (!members) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader
        as="h1"
        title="Настройки"
        description="Представители организации. Управление доступами будет добавлено отдельным этапом при необходимости."
      />
      <Card>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">{member.user_id}</p>
                <Badge variant={member.role === "owner" ? "success" : "info"}>
                  {member.role === "owner" ? "Владелец" : "Менеджер"}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
