import { apiRequest, ApiError } from "@/lib/api";
import { getDeviceId, storeSession } from "@/lib/session";

/**
 * Giriş vekili (proxy).
 *
 * Tarayıcı doğrudan API'ye gitmez: jetonlar httpOnly çereze burada yazılır
 * ve istemci JavaScript'i onları hiç görmez. Böylece sayfaya sızan bir
 * betik oturumu çalamaz.
 */
export async function POST(request: Request) {
  let payload: { email?: string; password?: string; remember?: boolean };

  try {
    payload = (await request.json()) as { email?: string; password?: string };
  } catch {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "Geçersiz istek." } },
      { status: 400 },
    );
  }

  if (!payload.email || !payload.password) {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "E-posta ve şifre zorunludur." } },
      { status: 400 },
    );
  }

  try {
    const { data } = await apiRequest<{
      access_token: string;
      refresh_token: string;
      user: { id: string; name: string; role: string };
    }>("/auth/login", {
      method: "POST",
      body: {
        email: payload.email,
        password: payload.password,
        device: {
          // Kalıcı kimlik: her girişte yenisini üretmek sunucuda gereksiz
          // oturum kaydı biriktiriyordu.
          deviceId: await getDeviceId(),
          platform: "WEB",
        },
      },
    });

    // "Beni hatırla" işaretli değilse yenileme çerezi oturumluk olur:
    // tarayıcı kapandığında silinir ve ortak bilgisayarda oturum kalmaz.
    await storeSession(data, { persistent: payload.remember !== false });

    // Jetonlar yanıtta dönmez; yalnızca çerezde durur.
    return Response.json({ data: { user: data.user } });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }

    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Giriş yapılamadı." } },
      { status: 502 },
    );
  }
}
