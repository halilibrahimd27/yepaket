import { apiRequest, ApiError } from "@/lib/api";

/**
 * Şifre sıfırlama için vekil.
 *
 * Tarayıcı API'ye doğrudan gitmez: tek origin üzerinden geçmek CORS
 * yapılandırmasını gereksiz kılar ve hız sınırının gerçek istemci IP'siyle
 * işlemesini sağlar.
 *
 * İki eylem tek uçta toplandı çünkü ikisi de kimlik gerektirmiyor ve aynı
 * hata dönüşümünü paylaşıyor.
 */

type Body =
  | { action: "request"; email: string }
  | { action: "confirm"; token: string; newPassword: string };

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let body: Partial<Body>;

  try {
    body = (await request.json()) as Partial<Body>;
  } catch {
    return fail(400, "VALIDATION_FAILED", "Geçersiz istek.");
  }

  const path =
    body.action === "request"
      ? "/auth/password-reset/request"
      : body.action === "confirm"
        ? "/auth/password-reset/confirm"
        : null;

  if (!path) {
    return fail(400, "VALIDATION_FAILED", "Geçersiz istek.");
  }

  // Gövde açıkça yeniden kuruluyor: istemcinin gönderdiği fazladan alanların
  // API'ye geçmesi, sunucudaki `forbidNonWhitelisted` kuralına takılıp
  // anlamsız bir doğrulama hatası üretirdi.
  const payload =
    body.action === "request"
      ? { email: String((body as { email?: unknown }).email ?? "") }
      : {
          token: String((body as { token?: unknown }).token ?? ""),
          newPassword: String((body as { newPassword?: unknown }).newPassword ?? ""),
        };

  try {
    await apiRequest<unknown>(path, { method: "POST", body: payload });
    return Response.json({ data: { ok: true } });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }

    return fail(502, "INTERNAL_ERROR", "İşlem tamamlanamadı. Lütfen tekrar deneyin.");
  }
}
