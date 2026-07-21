import { redirect } from "next/navigation";
import { isCurrentUserAdmin } from "@/features/admin-application-review/model/actions";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";
import { SectionNavigation } from "@/widgets/app-shell/ui/section-navigation";

const adminNavigationItems = [
  { label: "Обзор", href: "/admin", exact: true },
  { label: "Заявки", href: "/admin/applications" },
  { label: "Публикации", href: "/admin/publications" },
  { label: "Организации", href: "/admin/organizations" },
  { label: "Неточности", href: "/admin/reports" },
  { label: "Важные", href: "/admin/important-announcements" }
];

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login?next=/admin");
  }

  const isAdmin = await isCurrentUserAdmin();

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-form space-y-6">
        <SectionHeader
          as="h1"
          title="Доступ запрещен"
          description="Этот раздел доступен только администраторам."
        />
        <Card>
          <CardContent>
            <p className="text-sm leading-6 text-foreground-muted">
              Административные данные не загружены. Если доступ нужен, обратитесь к владельцу приложения.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionNavigation label="Навигация админ-панели" items={adminNavigationItems} />
      {children}
    </div>
  );
}
