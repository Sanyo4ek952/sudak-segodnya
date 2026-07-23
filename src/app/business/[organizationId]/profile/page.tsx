import { notFound } from "next/navigation";
import { getBusinessOrganization } from "@/features/business-cabinet/model/actions";
import { getOrganizationTypes } from "@/features/organization-application/model/actions";
import { OrganizationProfileForm } from "@/features/business-cabinet/ui/organization-profile-form";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

type ProfilePageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { organizationId } = await params;
  const [organization, organizationTypes] = await Promise.all([
    getBusinessOrganization(organizationId),
    getOrganizationTypes()
  ]);

  if (!organization) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader
        as="h1"
        title="Профиль организации"
        description="Основные публичные данные организации."
      />
      <Card>
        <CardContent>
          <OrganizationProfileForm organization={organization} organizationTypes={organizationTypes} />
        </CardContent>
      </Card>
    </div>
  );
}
