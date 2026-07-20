import { AuthPageCard } from "@/features/auth/ui/auth-page-card";
import { RegisterForm } from "@/features/auth/ui/register-form";

type RegisterPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/business";
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;

  return (
    <AuthPageCard
      title="Регистрация представителя"
      description="Создайте аккаунт, чтобы отправить заявку на организацию."
    >
      <RegisterForm nextPath={safeNext(params?.next)} />
    </AuthPageCard>
  );
}
