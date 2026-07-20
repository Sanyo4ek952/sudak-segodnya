import Link from "next/link";
import { AuthPageCard } from "@/features/auth/ui/auth-page-card";
import { ForgotPasswordForm } from "@/features/auth/ui/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthPageCard
      title="Восстановление пароля"
      description="Укажите email аккаунта, и мы отправим ссылку для смены пароля."
    >
      <ForgotPasswordForm />
      <Link className="inline-flex text-sm text-primary" href="/login">
        Вернуться ко входу
      </Link>
    </AuthPageCard>
  );
}
