import { afterEach, describe, expect, it } from "vitest";
import {
  createEventJsonLd,
  createOrganizationJsonLd,
  createOrganizationMetadata,
  createPublicationMetadata,
  getSiteUrl,
  getStableOpenGraphImage,
  serializeJsonLd,
  type PublicPublicationSeo
} from "./seo";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalNodeEnv = process.env.NODE_ENV;

const organization = {
  slug: "dom-kultury-sudak",
  name: "Дом культуры Судака",
  description: "Городская площадка для концертов."
};

const eventPublication: PublicPublicationSeo = {
  slug: "vecher-muzyki-na-naberezhnoy",
  type: "event",
  title: "Вечер музыки на набережной",
  description: "Открытый концерт у моря.",
  startsAt: "2026-08-10T19:00:00+03:00",
  endsAt: "2026-08-10T21:00:00+03:00",
  place: "Площадка у городского фонтана",
  organization
};

function setNodeEnv(value: string | undefined) {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, "NODE_ENV");
    return;
  }

  Reflect.set(process.env, "NODE_ENV", value);
}

function restoreEnvironment(name: "NEXT_PUBLIC_SITE_URL" | "NODE_ENV", value: string | undefined) {
  if (name === "NODE_ENV") {
    setNodeEnv(value);
    return;
  }

  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

afterEach(() => {
  restoreEnvironment("NEXT_PUBLIC_SITE_URL", originalSiteUrl);
  restoreEnvironment("NODE_ENV", originalNodeEnv);
});

describe("SEO metadata", () => {
  it("uses the configured local and production origins with normalized trailing slashes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000/";
    expect(getSiteUrl().toString()).toBe("http://localhost:3000/");

    process.env.NEXT_PUBLIC_SITE_URL = "https://sudak-today.vercel.app///";
    expect(getSiteUrl().toString()).toBe("https://sudak-today.vercel.app/");
  });

  it("uses safe environment defaults when the configured origin is absent or invalid", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    setNodeEnv("development");
    expect(getSiteUrl().toString()).toBe("http://localhost:3000/");

    process.env.NEXT_PUBLIC_SITE_URL = "ftp://example.com";
    setNodeEnv("production");
    expect(getSiteUrl().toString()).toBe("https://sudak-today.vercel.app/");
  });

  it("creates metadata for a regular publication without Event JSON-LD", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://sudak-today.vercel.app";
    const publication = { ...eventPublication, type: "news" };
    const metadata = createPublicationMetadata(publication);

    expect(metadata.title).toBe("Вечер музыки на набережной | Судак Сегодня");
    expect(metadata.description).toBe("Открытый концерт у моря.");
    expect(metadata.alternates?.canonical).toBe(
      "https://sudak-today.vercel.app/publications/vecher-muzyki-na-naberezhnoy"
    );
    expect(createEventJsonLd(publication)).toBeUndefined();
  });

  it("creates Event JSON-LD only for a valid event range", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://sudak-today.vercel.app";
    const jsonLd = createEventJsonLd(eventPublication);

    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Event",
      name: "Вечер музыки на набережной",
      description: "Открытый концерт у моря.",
      startDate: "2026-08-10T19:00:00+03:00",
      endDate: "2026-08-10T21:00:00+03:00",
      location: {
        "@type": "Place",
        name: "Площадка у городского фонтана"
      },
      organizer: {
        "@type": "Organization",
        name: "Дом культуры Судака",
        url: "https://sudak-today.vercel.app/organizations/dom-kultury-sudak"
      },
      url: "https://sudak-today.vercel.app/publications/vecher-muzyki-na-naberezhnoy"
    });

    expect(createEventJsonLd({ ...eventPublication, endsAt: eventPublication.startsAt })).toBeUndefined();
    expect(createEventJsonLd({ ...eventPublication, startsAt: "not-a-date" })).toBeUndefined();
  });

  it("omits absent optional fields and unstable images", () => {
    const metadata = createOrganizationMetadata({
      ...organization,
      description: null,
      image: "https://project.supabase.co/storage/v1/object/sign/organization-images/logo.png?token=temporary"
    });
    const organizationJsonLd = createOrganizationJsonLd({ ...organization, description: null });
    const eventJsonLd = createEventJsonLd({
      ...eventPublication,
      description: null,
      place: null
    });

    expect(metadata.openGraph).not.toHaveProperty("images");
    expect(organizationJsonLd).not.toHaveProperty("description");
    expect(eventJsonLd).not.toHaveProperty("description");
    expect(eventJsonLd).not.toHaveProperty("location");
    expect(getStableOpenGraphImage("http://example.com/image.jpg")).toBeUndefined();
    expect(
      getStableOpenGraphImage(
        "https://project.supabase.co/storage/v1/object/sign/publication-images/photo.jpg?token=temporary"
      )
    ).toBeUndefined();
  });

  it("escapes JSON-LD text so it cannot break out of the script element", () => {
    const serialized = serializeJsonLd({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "</script><script>alert('xss')</script> & тест"
    });

    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(serialized).toContain("\\u0026");
    expect(JSON.parse(serialized).name).toBe("</script><script>alert('xss')</script> & тест");
  });
});
