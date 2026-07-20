import { AuthPageCard } from "@/features/auth/ui/auth-page-card";
import { ResetPasswordForm } from "@/features/auth/ui/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthPageCard
      title="Новый пароль"
      description="Введите новый пароль для аккаунта представителя."
    >
      <ResetPasswordForm />
    </AuthPageCard>
  );
}
