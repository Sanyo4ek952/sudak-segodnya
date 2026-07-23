import { notFound } from "next/navigation";
import { getBusinessMembers } from "@/features/business-cabinet/model/actions";
import { RepresentativeManagement } from "@/features/business-cabinet/ui/representative-management";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

type SettingsPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { organizationId } = await params;
  const access = await getBusinessMembers(organizationId);

  if (!access) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader
        as="h1"
        title="Представители и настройки"
        description="Имена, email, роли и состояние доступа без технических UUID."
      />
      <Card>
        <CardContent>
          <RepresentativeManagement
            organizationId={organizationId}
            currentUserId={access.currentUserId}
            currentRole={access.currentRole}
            representatives={access.representatives}
            invitations={access.invitations}
          />
        </CardContent>
      </Card>
    </div>
  );
}
