import { AuthPageCard } from "@/features/auth/ui/auth-page-card";
import { LoginForm } from "@/features/auth/ui/login-form";

type LoginPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/business";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <AuthPageCard
      title="Вход для организаций"
      description="Войдите, чтобы подать заявку или посмотреть статус организации."
    >
      <LoginForm nextPath={safeNext(params?.next)} />
    </AuthPageCard>
  );
}
