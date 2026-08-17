/**
 * YePaket API istemcisi.
 *
 * Sözleşme: `docs/API_CONTRACT.md`. Tüm yanıtlar `{ data, meta }` zarfıyla,
 * hatalar `{ error: { code, message, details, request_id } }` biçiminde gelir.
 *
 * Bu dosya hem sunucu bileşenlerinden (SSR) hem route handler'lardan
 * kullanılır. Tarayıcıdan doğrudan çağrılmaz: erişim jetonu httpOnly
 * çerezde durur ve JavaScript'e hiç görünmez.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/v1";

/** İstemci tarafı kodun kullanacağı, jeton taşımayan yol öneki. */
export const INTERNAL_API = "/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Kullanıcıya gösterilebilecek mesaj. */
  get userMessage(): string {
    return this.message || "Beklenmeyen bir hata oluştu.";
  }
}

interface Envelope<T> {
  data: T;
  meta: Record<string, unknown>;
}

interface ErrorEnvelope {
  error: { code: string; message: string; details?: Record<string, unknown>; request_id?: string };
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  accessToken?: string;
  body?: unknown;
  /** Sunucu bileşenlerinde önbellek davranışı. */
  revalidateSeconds?: number;
  idempotencyKey?: string;
}

/** Zarfı açar ve hatayı `ApiError`'a çevirir. */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta: Record<string, unknown> }> {
  const { accessToken, body, revalidateSeconds, idempotencyKey, headers, ...init } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...(revalidateSeconds !== undefined
      ? { next: { revalidate: revalidateSeconds } }
      : { cache: "no-store" as RequestCache }),
  });

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = (payload as ErrorEnvelope).error;
    throw new ApiError(
      response.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? "İstek tamamlanamadı.",
      error?.details ?? {},
      error?.request_id ?? null,
    );
  }

  const envelope = payload as Envelope<T>;
  return { data: envelope.data, meta: envelope.meta ?? {} };
}

/**
 * Listeleme uçları için: hata durumunda boş liste döndürür.
 *
 * Tanıtım sayfası API'ye ulaşamadığı için tamamen çökmemeli; ziyaretçi en
 * azından sayfanın geri kalanını görmeli. Hata sunucu kaydına düşer.
 */
export async function apiRequestSafe<T>(
  path: string,
  fallback: T,
  options: RequestOptions = {},
): Promise<{ data: T; meta: Record<string, unknown>; failed: boolean }> {
  try {
    const result = await apiRequest<T>(path, options);
    return { ...result, failed: false };
  } catch (error) {
    console.error(`[api] ${path} başarısız:`, (error as Error).message);
    return { data: fallback, meta: {}, failed: true };
  }
}

// ---------------------------------------------------------------------------
// Sözleşme tipleri (snake_case — API'nin döndürdüğü biçim)
// ---------------------------------------------------------------------------

export interface Money {
  amount_minor: number;
  currency: string;
}

export interface BagStore {
  id: string;
  name: string;
  logo_url: string | null;
  location: { lat: number; lng: number };
  address: string;
  rating: number;
}

export interface Bag {
  id: string;
  store: BagStore;
  title: string;
  category: string;
  description: string | null;
  image_urls: string[];
  original_value: Money;
  sale_price: Money;
  discount_percent: number;
  available_quantity: number;
  pickup_window: { starts_at: string; ends_at: string };
  rating: { overall: number; count: number };
  distance_meters: number | null;
  is_favorite: boolean;
  status: string;
}

export interface PartnerOrder {
  id: string;
  order_no: string;
  status: string;
  customer_name: string;
  bag_title: string;
  quantity: number;
  total: Money;
  net: Money;
  pickup_window: { starts_at: string; ends_at: string };
  pickup_code: string | null;
  created_at: string;
  collected_at: string | null;
}

export interface PartnerBag extends Bag {
  sold_quantity: number;
  order_count: number;
}

export interface PartnerDashboard {
  store: {
    id: string;
    name: string;
    address: string;
    rating: { overall: number; count: number };
    rescued_bag_count: number;
    logo_url: string | null;
  };
  today: {
    revenue: Money;
    order_count: number;
    rescued_bags: number;
    new_customers: number;
  };
  pending_pickups: number;
  pickups_within_hour: number;
  active_bags: Bag[];
  daily_series: { date: string; rescued_bags: number; revenue: Money }[];
  lifetime: { rescued_bags: number; rating: { overall: number; count: number } };
}

/**
 * İşletmenin tam profili (`GET /partner/store`).
 *
 * Panel özeti (`/partner/dashboard`) yalnızca gösterim için gereken birkaç
 * alanı taşıyor; düzenleme formu telefon, açıklama ve çalışma saatlerine de
 * ihtiyaç duyduğu için bu uç ayrıca çağrılır.
 */
export interface StoreProfile {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  address: string;
  location: { lat: number; lng: number };
  phone: string | null;
  opening_time: string | null;
  closing_time: string | null;
  rating: { overall: number; count: number };
  rescued_bag_count: number;
}

export interface PayoutSummary {
  period: { start: string; end: string; label: string };
  gross: Money;
  commission: Money;
  refund: Money;
  net: Money;
  order_count: number;
  rescued_bags: number;
  commission_rate_bps: number;
  is_estimate: boolean;
  status: string;
  payout_ready: boolean;
}

export interface CommunityImpact {
  saved_bags: number;
  money_saved: Money;
  co2e_kg: number;
  water_liters: number;
  active_stores: number;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "CONSUMER" | "PARTNER" | "ADMIN";
  avatar_url: string | null;
}

// ---------------------------------------------------------------------------
// Biçimlendirme yardımcıları
// ---------------------------------------------------------------------------

const wholeLira = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const liraWithKurus = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Kuruşu Türkçe para biçiminde gösterir.
 *
 * Tam liraysa kuruş gösterilmez ("139 ₺"), değilse gösterilir ("139,50 ₺").
 * Önceden her tutar tam liraya yuvarlanıyordu: 139,50 ₺ olan bir paket
 * web'de "140 ₺", mobilde "139,50 ₺" görünüyordu. Aynı ürünün iki yerde
 * farklı fiyat göstermesi güven sorunu ve şikâyet üretir.
 *
 * Kural mobildeki `Formats.money` ile birebir aynıdır.
 */
export function formatMoney(money: Money | number): string {
  const minor = typeof money === "number" ? money : money.amount_minor;
  const value = minor / 100;
  return minor % 100 === 0 ? wholeLira.format(value) : liraWithKurus.format(value);
}

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

/**
 * Teslim aralığını okunur hâle getirir: "Bugün 20:00–20:30".
 * Gün etiketi kullanıcının değil, işletmenin saat diliminde hesaplanır.
 */
export function formatPickupWindow(window: { starts_at: string; ends_at: string }): string {
  const start = new Date(window.starts_at);
  const end = new Date(window.ends_at);

  const dayKey = (date: Date) =>
    new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short" }).format(
      date,
    );

  const today = dayKey(new Date());
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000));
  const startDay = dayKey(start);

  const prefix = startDay === today ? "Bugün" : startDay === tomorrow ? "Yarın" : startDay;

  return `${prefix} ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
}

/** Metre cinsinden mesafeyi kısa biçimde gösterir. */
export function formatDistance(meters: number | null): string | null {
  if (meters === null) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} km`;
}
