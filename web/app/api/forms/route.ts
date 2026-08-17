import { apiRequest, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

/**
 * Herkese açık form vekili.
 *
 * İşletme başvurusu ve destek talebi buradan geçer. Tarayıcıdan doğrudan
 * API'ye gitmek yerine vekil kullanmanın iki nedeni var: CORS'u
 * gevşetmeye gerek kalmıyor ve API adresi istemciye sızmıyor.
 */

type FormKind = "partner-application" | "support-ticket";

const ENDPOINTS: Record<FormKind, string> = {
  "partner-application": "/partners/applications",
  "support-ticket": "/support/tickets",
};

export async function POST(request: Request) {
  let body: { kind?: FormKind; payload?: Record<string, unknown> };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "Geçersiz istek." } },
      { status: 400 },
    );
  }

  const endpoint = body.kind ? ENDPOINTS[body.kind] : undefined;

  if (!endpoint || !body.payload) {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "Bilinmeyen form." } },
      { status: 400 },
    );
  }

  try {
    // Destek talebi giriş yapmış kullanıcıya bağlansın; başvuru için
    // jeton gerekmez ama varsa zarar vermez.
    const accessToken = await getAccessToken();

    const { data } = await apiRequest<Record<string, unknown>>(endpoint, {
      method: "POST",
      body: body.payload,
      accessToken,
    });

    return Response.json({ data });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.status },
      );
    }

    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Form gönderilemedi." } },
      { status: 502 },
    );
  }
}
