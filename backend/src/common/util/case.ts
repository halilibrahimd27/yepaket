/**
 * Sözleşme tüm alan adlarını snake_case ister; uygulama kodu camelCase yazar.
 * Dönüşüm tek yerde, yanıt zarfında yapılır — böylece her modülde elle
 * eşleme yazmak gerekmez ve isimlendirme kazara ayrışamaz.
 */

const cache = new Map<string, string>();

export function camelToSnake(value: string): string {
  const cached = cache.get(value);
  if (cached !== undefined) return cached;

  const converted = value
    // ardışık büyük harf grubunu koru: "orderID" -> "order_id"
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

  cache.set(value, converted);
  return converted;
}

/**
 * Nesne anahtarlarını derinlemesine snake_case'e çevirir.
 *
 * Dokunmadıkları:
 * - `Date` (ISO dizgiye çevrilir), `BigInt` (dizgiye çevrilir — JSON BigInt
 *   taşıyamaz ve kuruş tutarlarında hassasiyet kaybı kabul edilemez)
 * - Serbest biçimli JSON alanları: `keepAsIs` ile işaretlenen anahtarların
 *   *değerleri* olduğu gibi bırakılır (ör. bildirim `data` yükü).
 */
export function deepSnakeCase(input: unknown, keepAsIs: ReadonlySet<string> = DEFAULT_KEEP): unknown {
  if (input === null || input === undefined) return input;

  if (input instanceof Date) return input.toISOString();
  if (typeof input === 'bigint') return input.toString();

  if (Array.isArray(input)) {
    return input.map((item) => deepSnakeCase(item, keepAsIs));
  }

  if (typeof input === 'object') {
    // Buffer, Map gibi özel nesneleri dönüştürmeye çalışma.
    if (Object.getPrototypeOf(input) !== Object.prototype) return input;

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const snakeKey = camelToSnake(key);
      result[snakeKey] = keepAsIs.has(key) ? value : deepSnakeCase(value, keepAsIs);
    }
    return result;
  }

  return input;
}

/**
 * Değeri serbest biçimli JSON olan alanlar: anahtarın kendisi çevrilir ama
 * içeriğine dokunulmaz. Bunlar modeldeki `Json` kolonlarına karşılık gelir
 * (`Notification.data`, `AuditLog.meta`, `OutboxEvent.payload`) ve hata
 * gövdesindeki `details`.
 *
 * Not: Yanıt zarfının kendi `data`/`meta` anahtarları bu listeden etkilenmez;
 * zarf `ResponseEnvelopeInterceptor` içinde elle kurulur.
 */
const DEFAULT_KEEP: ReadonlySet<string> = new Set(['data', 'meta', 'details', 'payload']);
