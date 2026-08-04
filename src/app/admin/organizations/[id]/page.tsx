import { notFound } from "next/navigation";
import { getAdminOrganization } from "@/features/admin-quality-control/model/actions";
import { OrganizationProfileForm } from "@/features/business-cabinet/ui/organization-profile-form";
import { getOrganizationTypes } from "@/features/organization-application/model/actions";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

type AdminOrganizationEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminOrganizationEditPage({
  params
}: AdminOrganizationEditPageProps) {
  const { id } = await params;
  const [organization, organizationTypes] = await Promise.all([
    getAdminOrganization(id),
    getOrganizationTypes()
  ]);

  if (!organization) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader
        as="h1"
        title="Редактирование организации"
        description="Измените публичную информацию организации. Действие записывается в историю."
      />
      <Card>
        <CardContent>
          <OrganizationProfileForm
            organization={organization}
            organizationTypes={organizationTypes}
            isAdminEditor
          />
        </CardContent>
      </Card>
    </div>
  );
}
