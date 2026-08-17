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
  const [{ publications, nextCursor, error: publicationsError }, { announcement }] = await Promise.all([
    listPublicPublications({ filter }),
    getActiveImportantAnnouncement()
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="space-y-1 sm:space-y-1.5">
        <h1 className="text-3xl font-semibold leading-9 text-foreground sm:text-4xl sm:leading-10">
          Судак сегодня
        </h1>
        <p className="hidden max-w-form text-sm leading-6 text-foreground-muted sm:block sm:text-base sm:leading-7">
          Что происходит сейчас и в ближайшее время.
        </p>
      </section>
      <WeatherCompact />
      <PublicFeed
        key={filter}
        publications={publications}
        importantAnnouncement={announcement}
        filter={filter}
        nextCursor={nextCursor}
        error={publicationsError}
      />
    </div>
  );
}
