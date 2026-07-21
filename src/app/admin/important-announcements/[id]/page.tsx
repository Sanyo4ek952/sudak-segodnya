import { notFound } from "next/navigation";
import { getAdminAnnouncement } from "@/features/admin-quality-control/model/actions";
import { ImportantAnnouncementForm } from "@/features/admin-quality-control/ui/important-announcement-form";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

type AdminAnnouncementEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminAnnouncementEditPage({ params }: AdminAnnouncementEditPageProps) {
  const { id } = await params;
  const announcement = await getAdminAnnouncement(id);

  if (!announcement) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader
        as="h1"
        title="Редактировать объявление"
        description="Измените текст, период показа или связанную публикацию."
        action={
          <LinkButton href="/admin/important-announcements" variant="outline" size="sm">
            Назад
          </LinkButton>
        }
      />
      <Card>
        <CardContent>
          <ImportantAnnouncementForm announcement={announcement} onCancelHref="/admin/important-announcements" />
        </CardContent>
      </Card>
    </div>
  );
}
