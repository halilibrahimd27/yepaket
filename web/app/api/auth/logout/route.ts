import { apiRequest } from "@/lib/api";
import { clearSession, getAccessToken } from "@/lib/session";

/**
 * Çıkış.
 *
 * Sunucudaki oturum da kapatılır; yalnızca çerezi silmek yenileme
 * jetonunu geçerli bırakırdı.
 */
export async function POST() {
  const accessToken = await getAccessToken();

  if (accessToken) {
    try {
      await apiRequest("/auth/logout", { method: "POST", accessToken });
    } catch {
      // Sunucu tarafı çıkış başarısız olsa da yerel oturum kapatılmalı.
    }
  }

  await clearSession();
  return Response.json({ data: { loggedOut: true } });
}
