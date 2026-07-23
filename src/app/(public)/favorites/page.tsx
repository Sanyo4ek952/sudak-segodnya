import { FavoritesList } from "@/widgets/favorites/ui/favorites-list";
import { SectionHeader } from "@/shared/ui/section-header";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Избранное"
        description="Сохраненные публикации и организации хранятся локально на этом устройстве."
      />
      <FavoritesList />
    </div>
  );
}
