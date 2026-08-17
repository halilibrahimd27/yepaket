import { ConfirmResetForm } from "../components/PasswordResetForms";

export const metadata = {
  title: "Yeni şifre belirle — YePaket",
  description: "E-postanızdaki bağlantıyla yeni şifrenizi belirleyin.",
  // Jeton taşıyan bir adres indekslenmemeli.
  robots: { index: false, follow: false },
};

/**
 * Şifre sıfırlama onayı.
 *
 * Jeton, backend'in gönderdiği e-postadaki bağlantıda sorgu parametresi
 * olarak gelir: `${WEB_APP_URL}/sifre-sifirla?token=...`
 */
export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ConfirmResetForm token={token ?? ""} />;
}
