export type CalendarPublication = {
  id: string;
  type: "event";
  status: "published" | "cancelled" | "completed";
  title: string;
  description: string;
  organizationName: string;
  place: string;
  url: string;
  startsAt: string;
  endsAt: string;
};

type CalendarPublicationCandidate = {
  type: string;
  startsAt?: string;
  endsAt?: string;
};

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export function canAddPublicationToCalendar(publication: CalendarPublicationCandidate) {
  if (publication.type !== "event" || !publication.startsAt || !publication.endsAt) {
    return false;
  }

  if (!isValidDate(publication.startsAt) || !isValidDate(publication.endsAt)) {
    return false;
  }

  return new Date(publication.endsAt).getTime() > new Date(publication.startsAt).getTime();
}

function formatUtcDate(value: Date) {
  if (Number.isNaN(value.getTime())) {
    throw new Error("Calendar dates must be valid.");
  }

  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let chunk = "";
  let chunkLength = 0;

  for (const character of line) {
    const characterLength = encoder.encode(character).length;
    const limit = chunks.length === 0 ? 75 : 74;

    if (chunk && chunkLength + characterLength > limit) {
      chunks.push(chunk);
      chunk = character;
      chunkLength = characterLength;
      continue;
    }

    chunk += character;
    chunkLength += characterLength;
  }

  chunks.push(chunk);

  return chunks.map((value, index) => (index === 0 ? value : ` ${value}`)).join("\r\n");
}

function getUidHost(url: string) {
  try {
    return new URL(url).hostname || "sudak-today.local";
  } catch {
    return "sudak-today.local";
  }
}

export function createPublicationCalendarIcs(
  publication: CalendarPublication,
  generatedAt = new Date()
) {
  if (!canAddPublicationToCalendar(publication)) {
    throw new Error("Only events with valid start and end dates can be added to a calendar.");
  }

  const description = [
    publication.description,
    `Организатор: ${publication.organizationName}`,
    `Ссылка: ${publication.url}`
  ]
    .filter(Boolean)
    .join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sudak Today//Publication Calendar//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${publication.id}@${getUidHost(publication.url)}`,
    `DTSTAMP:${formatUtcDate(generatedAt)}`,
    `DTSTART:${formatUtcDate(new Date(publication.startsAt))}`,
    `DTEND:${formatUtcDate(new Date(publication.endsAt))}`,
    `SUMMARY:${escapeIcsText(publication.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(publication.place)}`,
    `URL:${publication.url}`,
    ...(publication.status === "cancelled" ? ["STATUS:CANCELLED"] : []),
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function getPublicationCalendarFilename(title: string) {
  const filename = title
    .toLocaleLowerCase("ru-RU")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  return `${filename || "sobytie"}.ics`;
}
