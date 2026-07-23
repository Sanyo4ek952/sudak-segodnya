import { PublicFeed } from "@/widgets/public-feed/ui/public-feed";
import { WeatherCompact } from "@/widgets/weather/ui/weather-compact";
import {
  normalizePublicationFilter,
  type PublicationFilterSearchParams
} from "@/entities/publication/model/filters";
import {
  getActiveImportantAnnouncement,
  listPublicPublications
} from "@/entities/publication/api/publications";
import { createPageMetadata } from "@/shared/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Судак Сегодня — события, объявления и организации",
  description: "Городская лента актуальных событий, объявлений и организаций Судака.",
  path: "/"
});

type HomePageProps = {
  searchParams: Promise<PublicationFilterSearchParams>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const filter = normalizePublicationFilter(await searchParams);
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
      <PublicFeed
        publications={publications}
        importantAnnouncement={announcement}
        filter={filter}
        error={publicationsError}
      />
    </div>
  );
}
