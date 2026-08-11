import type { Bag, BagCategory, Store } from '../../generated/prisma/client';

/**
 * Sözleşmedeki paket gösterimi.
 *
 * Alan adları burada camelCase yazılır; snake_case'e çevrim yanıt zarfında
 * tek noktadan yapılır. Kategori değerleri sözleşmede küçük harftir
 * (`bakery`), bu yüzden burada dönüştürülür.
 */
export interface MoneyView {
  amountMinor: number;
  currency: string;
}

export interface BagView {
  id: string;
  store: {
    id: string;
    name: string;
    logoUrl: string | null;
    location: { lat: number; lng: number };
    address: string;
    rating: number;
  };
  title: string;
  category: string;
  description: string | null;
  imageUrls: string[];
  originalValue: MoneyView;
  salePrice: MoneyView;
  /** Yüzde cinsinden indirim; istemcilerin tekrar hesaplamasına gerek kalmaz. */
  discountPercent: number;
  availableQuantity: number;
  pickupWindow: { startsAt: Date; endsAt: Date };
  rating: { overall: number; count: number };
  distanceMeters: number | null;
  isFavorite: boolean;
  status: string;
}

export function toCategoryValue(category: BagCategory): string {
  return category.toLowerCase();
}

/** Ham SQL sonucunda gelen satır (kolon adları snake_case'tir). */
export interface BagRow {
  id: string;
  title: string;
  category: BagCategory;
  description: string | null;
  image_urls: string[];
  original_value_minor: number;
  sale_price_minor: number;
  currency: string;
  available_quantity: number;
  pickup_starts_at: Date;
  pickup_ends_at: Date;
  status: string;
  store_id: string;
  store_name: string;
  store_logo_url: string | null;
  store_address: string;
  store_district: string;
  store_city: string;
  store_latitude: number;
  store_longitude: number;
  store_rating: number;
  store_rating_count: number;
  distance_meters: number | null;
  is_favorite: boolean;
}

function discountPercent(originalMinor: number, saleMinor: number): number {
  if (originalMinor <= 0) return 0;
  return Math.round((1 - saleMinor / originalMinor) * 100);
}

export function presentBagRow(row: BagRow): BagView {
  return {
    id: row.id,
    store: {
      id: row.store_id,
      name: row.store_name,
      logoUrl: row.store_logo_url,
      location: { lat: row.store_latitude, lng: row.store_longitude },
      address: `${row.store_address}, ${row.store_district}/${row.store_city}`,
      rating: Number(row.store_rating),
    },
    title: row.title,
    category: toCategoryValue(row.category),
    description: row.description,
    imageUrls: row.image_urls,
    originalValue: { amountMinor: row.original_value_minor, currency: row.currency },
    salePrice: { amountMinor: row.sale_price_minor, currency: row.currency },
    discountPercent: discountPercent(row.original_value_minor, row.sale_price_minor),
    availableQuantity: row.available_quantity,
    pickupWindow: { startsAt: row.pickup_starts_at, endsAt: row.pickup_ends_at },
    rating: { overall: Number(row.store_rating), count: row.store_rating_count },
    // Konum verilmediyse mesafe hesaplanamaz; 0 döndürmek yanıltıcı olurdu.
    distanceMeters: row.distance_meters === null ? null : Math.round(row.distance_meters),
    isFavorite: row.is_favorite,
    status: row.status.toLowerCase(),
  };
}

/** Prisma nesnesinden gösterim (ham SQL kullanılmayan yerlerde). */
export function presentBag(
  bag: Bag & { store: Store },
  options: { distanceMeters?: number | null; isFavorite?: boolean } = {},
): BagView {
  return presentBagRow({
    id: bag.id,
    title: bag.title,
    category: bag.category,
    description: bag.description,
    image_urls: bag.imageUrls,
    original_value_minor: bag.originalValueMinor,
    sale_price_minor: bag.salePriceMinor,
    currency: bag.currency,
    available_quantity: bag.availableQuantity,
    pickup_starts_at: bag.pickupStartsAt,
    pickup_ends_at: bag.pickupEndsAt,
    status: bag.status,
    store_id: bag.store.id,
    store_name: bag.store.name,
    store_logo_url: bag.store.logoUrl,
    store_address: bag.store.addressLine,
    store_district: bag.store.district,
    store_city: bag.store.city,
    store_latitude: bag.store.latitude,
    store_longitude: bag.store.longitude,
    store_rating: bag.store.ratingAverage,
    store_rating_count: bag.store.ratingCount,
    distance_meters: options.distanceMeters ?? null,
    is_favorite: options.isFavorite ?? false,
  });
}

export interface StoreView {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  address: string;
  location: { lat: number; lng: number };
  phone: string | null;
  openingTime: string | null;
  closingTime: string | null;
  rating: { overall: number; count: number };
  rescuedBagCount: number;
  isFavorite: boolean;
}

export function presentStore(store: Store, isFavorite = false): StoreView {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    category: toCategoryValue(store.category),
    description: store.description,
    logoUrl: store.logoUrl,
    coverUrl: store.coverUrl,
    address: `${store.addressLine}, ${store.district}/${store.city}`,
    location: { lat: store.latitude, lng: store.longitude },
    phone: store.phone,
    openingTime: store.openingTime,
    closingTime: store.closingTime,
    rating: { overall: store.ratingAverage, count: store.ratingCount },
    rescuedBagCount: store.rescuedBagCount,
    isFavorite,
  };
}
