import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "../components/LoginForm";

export const metadata = {
  title: "İşletme girişi — YePaket",
  description: "MyStore paneline giriş yapın.",
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ devam?: string }>;
}) {
  const { devam } = await searchParams;

  // Zaten giriş yapmışsa formu göstermenin anlamı yok.
  const user = await getSessionUser();
  if (user) {
    redirect(user.role === "ADMIN" || user.role === "PARTNER" ? "/panel" : "/");
  }

  // Açık yönlendirme (open redirect) koruması: yalnızca kendi sitemizdeki
  // göreli yollara dönülür.
  const returnTo = devam && devam.startsWith("/") && !devam.startsWith("//") ? devam : "/panel";

  return <LoginForm returnTo={returnTo} />;
}
