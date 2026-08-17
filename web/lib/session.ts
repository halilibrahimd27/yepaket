import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiRequest, ApiError, type SessionUser } from "./api";

/**
 * Oturum yönetimi.
 *
 * Jetonlar **httpOnly** çerezde tutulur: JavaScript'e görünmedikleri için
 * XSS ile çalınamazlar. localStorage kullanmak, sayfaya sızan tek bir
 * betiğin oturumu ele geçirmesi demek olurdu.
 */

const ACCESS_COOKIE = "yp_access";
const REFRESH_COOKIE = "yp_refresh";

/** Erişim jetonu kısa ömürlü; yenileme jetonu uzun. */
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 60 * 24 * 3600;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    // Üretimde HTTPS zorunlu; geliştirmede http://localhost çalışabilsin.
    secure: process.env.NODE_ENV === "production",
    // "lax": normal gezinmede çerez gider ama siteler arası POST'ta gitmez
    // (CSRF yüzeyini daraltır).
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function storeSession(tokens: {
  access_token: string;
  refresh_token: string;
}): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, tokens.access_token, cookieOptions(ACCESS_MAX_AGE));
  jar.set(REFRESH_COOKIE, tokens.refresh_token, cookieOptions(REFRESH_MAX_AGE));
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value;
}

/**
 * Oturum açmış kullanıcıyı döndürür, yoksa `null`.
 *
 * Erişim jetonu süresi dolduysa yenileme denenir; sunucu bileşeninden
 * çerez yazılamadığı için yenileme yalnızca route handler'da kalıcı olur.
 * Burada elde edilen taze jeton isteğin geri kalanında kullanılır.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  try {
    const { data } = await apiRequest<SessionUser>("/auth/me", { accessToken });
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    // Ağ hatası oturumu düşürmemeli; kullanıcı yeniden denesin.
    console.error("[session] /auth/me başarısız:", (error as Error).message);
    return null;
  }
}

/**
 * Korumalı sayfalar için: oturum yoksa girişe yönlendirir.
 * `returnTo` ile kullanıcı giriş sonrası geldiği yere döner.
 */
export async function requireUser(
  returnTo: string,
  allowedRoles?: SessionUser["role"][],
): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    redirect(`/giris?devam=${encodeURIComponent(returnTo)}`);
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Yetkisiz rol girişe değil ana sayfaya gider; tekrar giriş yapmak
    // sorunu çözmez.
    redirect("/?hata=yetkisiz");
  }

  return user;
}
