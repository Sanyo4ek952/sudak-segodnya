import { FavoritesList } from "@/widgets/favorites/ui/favorites-list";
import { SectionHeader } from "@/shared/ui/section-header";
import { listPublicOrganizations } from "@/entities/organization/api/organizations";
import { listPublicPublications } from "@/entities/publication/api/publications";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const [{ publications }, { organizations }] = await Promise.all([
    listPublicPublications(),
    listPublicOrganizations()
  ]);

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Избранное"
        description="Сохраненные публикации и организации хранятся локально на этом устройстве."
      />
      <FavoritesList publications={publications} organizations={organizations} />
    </div>
  );
}
