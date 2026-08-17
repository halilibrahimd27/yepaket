import { apiRequest, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

/**
 * Panel eylemleri için vekil.
 *
 * İstemci jetonu hiç görmez; oturum çerezi burada okunup API'ye
 * `Authorization` başlığı olarak iletilir.
 *
 * Yalnızca beyaz listedeki yollara izin verilir: aksi hâlde istemci bu
 * vekil üzerinden herhangi bir API ucuna, örneğin yönetici uçlarına,
 * istek gönderebilirdi.
 */
const ALLOWED = [
  { method: "POST", pattern: /^\/partner\/bags$/ },
  { method: "PATCH", pattern: /^\/partner\/bags\/[0-9a-f-]{36}$/i },
  { method: "POST", pattern: /^\/partner\/bags\/[0-9a-f-]{36}\/(publish|pause)$/i },
  { method: "DELETE", pattern: /^\/partner\/bags\/[0-9a-f-]{36}$/i },
  { method: "POST", pattern: /^\/partner\/orders\/[0-9a-f-]{36}\/confirm-pickup$/i },
  { method: "PATCH", pattern: /^\/partner\/store$/ },
] as const;

function isAllowed(method: string, path: string): boolean {
  return ALLOWED.some((rule) => rule.method === method && rule.pattern.test(path));
}

export async function POST(request: Request) {
  let body: { path?: string; method?: string; payload?: unknown };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "Geçersiz istek." } },
      { status: 400 },
    );
  }

  const method = (body.method ?? "POST").toUpperCase();
  const path = body.path ?? "";

  if (!isAllowed(method, path)) {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Bu işlem paneldan yapılamaz." } },
      { status: 403 },
    );
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return Response.json(
      { error: { code: "UNAUTHENTICATED", message: "Oturum süresi doldu." } },
      { status: 401 },
    );
  }

  try {
    const { data } = await apiRequest<unknown>(path, {
      method,
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
      { error: { code: "INTERNAL_ERROR", message: "İşlem tamamlanamadı." } },
      { status: 502 },
    );
  }
}
