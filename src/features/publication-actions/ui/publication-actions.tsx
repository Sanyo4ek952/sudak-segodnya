"use client";

import { useState } from "react";
import { AnalyticsLinkButton } from "@/features/analytics/ui/analytics-link-button";
import {
  canAddPublicationToCalendar,
  createPublicationCalendarIcs,
  getPublicationCalendarFilename,
  type CalendarPublication
} from "@/features/publication-actions/model/calendar";
import type { Publication } from "@/entities/publication/model/types";
import { Button, LinkButton } from "@/shared/ui/button";

type PublicationActionsProps = {
  publication: Pick<
    Publication,
    "id" | "type" | "status" | "title" | "description" | "startsAt" | "endsAt" | "place" | "contactPhone"
  > & {
    organization: Publication["organization"];
  };
};

type Feedback = {
  message: string;
  tone: "success" | "error";
};

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Some browsers expose Clipboard API but deny its use outside a secure context.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function isShareDismissed(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function PublicationActions({ publication }: PublicationActionsProps) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const canAddToCalendar = canAddPublicationToCalendar(publication);
  const calendarPublication: CalendarPublication | null = canAddToCalendar
    ? {
        id: publication.id,
        type: "event",
        status: publication.status,
        title: publication.title,
        description: publication.description,
        organizationName: publication.organization.name,
        place: publication.place,
        url: "",
        startsAt: publication.startsAt ?? "",
        endsAt: publication.endsAt ?? ""
      }
    : null;
  const contactPhoneHref = publication.contactPhone
    ? `tel:${publication.contactPhone.replace(/\D/g, "")}`
    : null;

  const getPublicUrl = () => window.location.href;

  const handleShare = async () => {
    setFeedback(null);
    const url = getPublicUrl();

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: publication.title,
          text: publication.description || publication.organization.name,
          url
        });
        return;
      } catch (error) {
        if (isShareDismissed(error)) {
          return;
        }
      }
    }

    const copied = await copyToClipboard(url);
    setFeedback(
      copied
        ? { tone: "success", message: "Ссылка на публикацию скопирована." }
        : { tone: "error", message: "Не удалось скопировать ссылку. Скопируйте её из адресной строки." }
    );
  };

  const handleCalendarDownload = () => {
    if (!calendarPublication) {
      return;
    }

    setFeedback(null);

    try {
      const ics = createPublicationCalendarIcs({ ...calendarPublication, url: getPublicUrl() });
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getPublicationCalendarFilename(publication.title);
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setFeedback({ tone: "success", message: "Файл календаря скачан." });
    } catch {
      setFeedback({ tone: "error", message: "Не удалось создать файл календаря." });
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        {contactPhoneHref ? <LinkButton href={contactPhoneHref}>Позвонить</LinkButton> : null}
        <AnalyticsLinkButton
          href={`https://yandex.ru/maps/?text=${encodeURIComponent(publication.place)}`}
          variant="outline"
          target="_blank"
          rel="noreferrer"
          analytics={{
            eventName: "route_click",
            organizationId: publication.organization.id,
            publicationId: publication.id
          }}
        >
          Маршрут
        </AnalyticsLinkButton>
        {canAddToCalendar ? (
          <Button type="button" variant="outline" onClick={handleCalendarDownload}>
            В календарь
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={handleShare}>
          Поделиться
        </Button>
      </div>
      {feedback ? (
        <p className={feedback.tone === "error" ? "text-sm text-error" : "text-sm text-success"} role="status">
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
