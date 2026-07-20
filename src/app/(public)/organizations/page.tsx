import { organizations } from "@/entities/organization/model/mock";
import { OrganizationCard } from "@/entities/organization/ui/organization-card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeader } from "@/shared/ui/section-header";

export default function OrganizationsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Каталог организаций"
        description="Кафе, музеи, кружки, экскурсии и городские сервисы с актуальными публикациями."
      />
      {organizations.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {organizations.map((organization) => (
            <OrganizationCard key={organization.id} organization={organization} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Организаций пока нет"
          description="Каталог появится после подтверждения первых организаций."
        />
      )}
    </div>
  );
}
