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
const DEVICE_COOKIE = "yp_device";

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

export async function storeSession(
  tokens: { access_token: string; refresh_token: string },
  options: { persistent?: boolean } = {},
): Promise<void> {
  const jar = await cookies();

  jar.set(ACCESS_COOKIE, tokens.access_token, cookieOptions(ACCESS_MAX_AGE));

  // `persistent: false` → `maxAge` verilmez, çerez oturumluk olur ve
  // tarayıcı kapandığında silinir. "Beni hatırla" işaretini kaldıran
  // kullanıcının beklentisi budur; ortak bilgisayarda önemlidir.
  jar.set(
    REFRESH_COOKIE,
    tokens.refresh_token,
    options.persistent === false
      ? { ...cookieOptions(REFRESH_MAX_AGE), maxAge: undefined }
      : cookieOptions(REFRESH_MAX_AGE),
  );
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
 * Tarayıcıya sabitlenmiş cihaz kimliği.
 *
 * Her girişte yeni kimlik üretmek sunucuda her seferinde yeni bir oturum
 * kaydı açar; "cihazlarım" listesi aynı tarayıcıyı onlarca kez gösterir ve
 * kullanıcı hangisinin kendi bilgisayarı olduğunu ayırt edemez. Mobil
 * istemci de kimliği kalıcı saklıyor; davranışlar böylece aynı.
 *
 * Kimlik gizli bilgi değildir ama httpOnly tutulur: sayfaya sızan bir betiğin
 * okumasına gerek yok.
 */
export async function getDeviceId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(DEVICE_COOKIE)?.value;
  if (existing) return existing;

  const id = `web-${crypto.randomUUID()}`;
  jar.set(DEVICE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    // Cihaz kimliği oturumdan uzun yaşar: kullanıcı çıkıp yeniden girdiğinde
    // aynı cihaz olarak tanınmalı.
    maxAge: 2 * 365 * 24 * 3600,
  });

  return id;
}

/**
 * Oturum açmış kullanıcıyı döndürür, yoksa `null`.
 *
 * **Burada yenileme YAPILMAZ.** Yenileme jetonu her kullanımda döner ve
 * yenisi saklanmalıdır; sunucu bileşenleri çerez yazamadığı için buradan
 * yenilemek dönen jetonu kaybeder ve bir sonraki denemede sunucu bunu
 * "kullanılmış jeton" sayıp tüm oturumları kapatır.
 *
 * Yenileme yalnızca `/api/auth/refresh` route handler'ında yapılır ve
 * istemcideki `SessionKeeper` bileşeni bunu erişim jetonunun ömrü dolmadan
 * düzenli olarak tetikler.
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
    // sorunu çözmez. Parametre ana sayfada okunup kullanıcıya neden
    // yönlendirildiği söylenir — eskiden hiçbir yerde okunmuyordu.
    redirect("/?hata=yetkisiz");
  }

  return user;
}
