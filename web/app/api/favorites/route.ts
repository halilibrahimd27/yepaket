import { apiRequest, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

/**
 * Favori ekleme/çıkarma vekili.
 *
 * Tanıtım sayfasındaki kalp düğmesi yalnızca yerel bir diziyi değiştiriyordu:
 * sayfa yenilendiğinde favori kayboluyor, mobil uygulamada hiç görünmüyordu.
 * Sunucudaki uçlar baştan beri hazırdı.
 *
 * Jeton httpOnly çerezde kaldığı için istek buradan geçer; tarayıcıya hiç
 * açılmaz.
 */
export async function POST(request: Request) {
  let body: { bagId?: string; favorite?: boolean };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "Geçersiz istek." } },
      { status: 400 },
    );
  }

  const bagId = body.bagId ?? "";

  // UUID doğrulaması: vekil yalnızca gerçek bir paket kimliğiyle çağrılmalı.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bagId)) {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "Geçersiz paket." } },
      { status: 400 },
    );
  }

  const accessToken = await getAccessToken();

  if (!accessToken) {
    // İstemci bu kodu görüp kullanıcıyı girişe yönlendirir.
    return Response.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Favorilere eklemek için giriş yapmalısın.",
        },
      },
      { status: 401 },
    );
  }

  try {
    await apiRequest<unknown>(`/bags/${bagId}/favorite`, {
      method: body.favorite === false ? "DELETE" : "POST",
      accessToken,
    });

    return Response.json({ data: { favorite: body.favorite !== false } });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }

    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "İşlem tamamlanamadı." } },
      { status: 502 },
    );
  }
}
