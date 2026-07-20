import { PublicFeed } from "@/widgets/public-feed/ui/public-feed";
import { WeatherCompact } from "@/widgets/weather/ui/weather-compact";
import {
  getActiveImportantAnnouncement,
  listPublicPublications
} from "@/entities/publication/api/publications";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ publications, error: publicationsError }, { announcement }] = await Promise.all([
    listPublicPublications(),
    getActiveImportantAnnouncement()
  ]);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-sm font-medium text-primary">Судак сейчас</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            Что происходит в городе сегодня
          </h1>
          <p className="max-w-form text-base leading-7 text-foreground-muted">
            События, объявления, акции и полезные обновления от организаций Судака в одной легкой ленте.
          </p>
        </div>
      </section>
      <WeatherCompact />
      <PublicFeed publications={publications} importantAnnouncement={announcement} error={publicationsError} />
    </div>
  );
}
