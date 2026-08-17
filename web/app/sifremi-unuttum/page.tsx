import { RequestResetForm } from "../components/PasswordResetForms";

export const metadata = {
  title: "Şifremi unuttum — YePaket",
  description: "Hesabınıza bağlı e-posta adresine şifre sıfırlama bağlantısı gönderin.",
  // Arama motorlarında görünmesi gereksiz; yalnızca giriş sayfasından ulaşılır.
  robots: { index: false, follow: false },
};

export default function ForgotPassword() {
  return <RequestResetForm />;
}
