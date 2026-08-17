import { apiRequest, ApiError } from "@/lib/api";
import { clearSession, getDeviceId, getRefreshToken, storeSession } from "@/lib/session";

/**
 * Oturumu yeniler.
 *
 * **Neden ayrı bir route handler:** Yenileme jetonu her kullanımda döner ve
 * yenisi mutlaka saklanmalıdır. Sunucu bileşenleri (RSC) çerez yazamaz —
 * oradan yenileme yapmak, dönen jetonu kaybedip bir sonraki denemede
 * "kullanılmış jeton" olarak algılanmasına ve tüm oturumların kapatılmasına
 * yol açardı. Bu yüzden yenileme yalnızca çerez yazabilen bu uçta yapılır.
 *
 * İstemci tarafındaki `SessionKeeper` bunu erişim jetonunun ömrü dolmadan
 * düzenli olarak çağırır.
 */
export async function POST() {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return Response.json(
      { error: { code: "UNAUTHENTICATED", message: "Oturum bulunamadı." } },
      { status: 401 },
    );
  }

  try {
    const { data } = await apiRequest<{
      access_token: string;
      refresh_token: string;
    }>("/auth/refresh", {
      method: "POST",
      body: {
        refreshToken,
        device: { deviceId: await getDeviceId(), platform: "WEB" },
      },
    });

    await storeSession(data);
    return Response.json({ data: { ok: true } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // Jeton geçersiz veya çalınmış olarak işaretlenmiş; çerezleri
      // temizlemek kullanıcıyı girişe yönlendirir.
      await clearSession();
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: 401 },
      );
    }

    // Ağ hatası oturumu düşürmemeli; istemci tekrar dener.
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Yenileme başarısız." } },
      { status: 502 },
    );
  }
}
