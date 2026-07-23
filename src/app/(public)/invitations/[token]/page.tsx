import { redirect } from "next/navigation";
import { acceptOrganizationInvitationAction } from "@/features/business-cabinet/model/actions";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";
import { SubmitButton } from "@/shared/ui/submit-button";

type InvitationPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function InvitationPage({ params, searchParams }: InvitationPageProps) {
  const { token } = await params;
  const query = await searchParams;

  if (!/^[a-f0-9]{64}$/.test(token)) {
    redirect("/business?invitation=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const next = `/invitations/${token}`;

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader
        as="h1"
        title="Приглашение в организацию"
        description="Доступ будет добавлен только аккаунту с email, указанным владельцем организации."
      />
      <Card>
        <CardContent className="space-y-4">
          {query.error ? (
            <p role="alert" className="rounded-md bg-error/10 p-3 text-sm text-error">
              Не удалось принять приглашение. Проверьте email аккаунта, срок действия ссылки и её статус.
            </p>
          ) : null}
          {data.user ? (
            <>
              <p className="text-sm leading-6 text-foreground-muted">
                Вы вошли как <span className="font-medium text-foreground">{data.user.email}</span>.
              </p>
              <form action={acceptOrganizationInvitationAction}>
                <input type="hidden" name="token" value={token} />
                <SubmitButton pendingLabel="Принимаем...">Принять приглашение</SubmitButton>
              </form>
            </>
          ) : (
            <div className="flex flex-wrap gap-3">
              <LinkButton href={`/login?next=${encodeURIComponent(next)}`}>Войти</LinkButton>
              <LinkButton href={`/register?next=${encodeURIComponent(next)}`} variant="outline">
                Создать аккаунт
              </LinkButton>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
