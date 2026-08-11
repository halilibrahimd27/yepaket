import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { BagSort, type NearbyQueryDto } from './dto/discovery.dto';
import { presentBagRow, type BagRow, type BagView } from './catalog.presenter';

/**
 * Paket keşfi.
 *
 * Sorgu ham SQL ile yazılır çünkü:
 * - mesafe hesabı PostGIS fonksiyonlarını gerektirir ve ORM üzerinden
 *   ifade indeksini kullanacak biçimde üretilemez,
 * - "favori mi" bilgisi tek sorguda LEFT JOIN ile gelmelidir; aksi hâlde
 *   liste başına ek sorgu (N+1) doğar.
 *
 * Tüm kullanıcı girdileri parametre olarak bağlanır; hiçbir değer SQL
 * metnine gömülmez.
 */
@Injectable()
export class DiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Kullanıcı konumu verilmişse mesafe ifadesi, yoksa NULL. */
  private distanceExpression(lat?: number, lng?: number): Prisma.Sql {
    if (lat === undefined || lng === undefined) {
      return Prisma.sql`NULL::double precision`;
    }

    return Prisma.sql`ST_Distance(
      ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    )`;
  }

  private buildFilters(query: NearbyQueryDto): Prisma.Sql[] {
    const filters: Prisma.Sql[] = [
      // Yalnızca yayında, stoğu olan ve teslim aralığı henüz geçmemiş paketler.
      Prisma.sql`b.status = 'PUBLISHED'::"BagStatus"`,
      Prisma.sql`b.available_quantity > 0`,
      Prisma.sql`b.pickup_ends_at > now()`,
      // Onaylanmamış işletmenin paketi listelenmez.
      Prisma.sql`s.status = 'APPROVED'::"StoreStatus"`,
    ];

    if (query.category) {
      filters.push(Prisma.sql`b.category = ${query.category}::"BagCategory"`);
    }

    if (query.maxPriceMinor !== undefined) {
      filters.push(Prisma.sql`b.sale_price_minor <= ${query.maxPriceMinor}`);
    }

    if (query.lat !== undefined && query.lng !== undefined) {
      // ST_DWithin indeksi kullanır; ST_Distance ile filtrelemek tüm
      // satırları taramak anlamına gelirdi.
      filters.push(Prisma.sql`ST_DWithin(
        ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography,
        ${(query.radiusKm ?? 10) * 1000}
      )`);
    }

    // Teslim saati filtresi kullanıcının yerel saatine göre değerlendirilir.
    if (query.pickupFrom) {
      filters.push(
        Prisma.sql`(b.pickup_starts_at AT TIME ZONE 'Europe/Istanbul')::time >= ${query.pickupFrom}::time`,
      );
    }
    if (query.pickupTo) {
      filters.push(
        Prisma.sql`(b.pickup_starts_at AT TIME ZONE 'Europe/Istanbul')::time <= ${query.pickupTo}::time`,
      );
    }

    if (query.q) {
      // Trigram benzerliği: yazım hatasına toleranslı arama. ILIKE ile
      // birleştirilir ki tam alt dize eşleşmesi de yakalansın.
      const term = `%${query.q}%`;
      filters.push(Prisma.sql`(
        b.title ILIKE ${term}
        OR s.name ILIKE ${term}
        OR similarity(b.title, ${query.q}) > 0.25
        OR similarity(s.name, ${query.q}) > 0.25
      )`);
    }

    return filters;
  }

  /**
   * Sıralama yalnızca beyaz listeden seçilir; kullanıcı girdisi hiçbir
   * durumda ORDER BY metnine geçmez.
   */
  private orderBy(sort: BagSort, hasLocation: boolean): Prisma.Sql {
    switch (sort) {
      case BagSort.DISTANCE:
        return hasLocation
          ? Prisma.sql`distance_meters ASC NULLS LAST`
          : Prisma.sql`s.rating_average DESC`;
      case BagSort.PRICE:
        return Prisma.sql`b.sale_price_minor ASC`;
      case BagSort.RATING:
        return Prisma.sql`s.rating_average DESC, s.rating_count DESC`;
      case BagSort.PICKUP_TIME:
        return Prisma.sql`b.pickup_starts_at ASC`;
      case BagSort.RELEVANCE:
      default:
        // Alaka: önce yakın olan, sonra indirimi yüksek olan, sonra puanı
        // yüksek olan. Konum yoksa mesafe devre dışı kalır.
        return hasLocation
          ? Prisma.sql`distance_meters ASC NULLS LAST,
              (1 - b.sale_price_minor::float / NULLIF(b.original_value_minor, 0)) DESC,
              s.rating_average DESC`
          : Prisma.sql`(1 - b.sale_price_minor::float / NULLIF(b.original_value_minor, 0)) DESC,
              s.rating_average DESC`;
    }
  }

  async nearby(query: NearbyQueryDto, userId?: string): Promise<Paginated<BagView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const hasLocation = query.lat !== undefined && query.lng !== undefined;

    const where = Prisma.join(this.buildFilters(query), ' AND ');
    const distance = this.distanceExpression(query.lat, query.lng);

    // Favori bilgisi tek sorguda gelir; kullanıcı yoksa sabit false.
    const favoriteJoin = userId
      ? Prisma.sql`LEFT JOIN favorites f ON f.store_id = s.id AND f.user_id = ${userId}::uuid`
      : Prisma.empty;
    const favoriteSelect = userId
      ? Prisma.sql`(f.id IS NOT NULL)`
      : Prisma.sql`false`;

    const rows = await this.prisma.$queryRaw<BagRow[]>(Prisma.sql`
      SELECT
        b.id, b.title, b.category, b.description, b.image_urls,
        b.original_value_minor, b.sale_price_minor, b.currency,
        b.available_quantity, b.pickup_starts_at, b.pickup_ends_at, b.status,
        s.id AS store_id, s.name AS store_name, s.logo_url AS store_logo_url,
        s.address_line AS store_address, s.district AS store_district,
        s.city AS store_city, s.latitude AS store_latitude,
        s.longitude AS store_longitude, s.rating_average AS store_rating,
        s.rating_count AS store_rating_count,
        ${distance} AS distance_meters,
        ${favoriteSelect} AS is_favorite
      FROM bags b
      JOIN stores s ON s.id = b.store_id
      ${favoriteJoin}
      WHERE ${where}
      ORDER BY ${this.orderBy(query.sort ?? BagSort.RELEVANCE, hasLocation)}
      LIMIT ${limit} OFFSET ${offset}
    `);

    const [{ count }] = await this.prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
      SELECT count(*)::bigint AS count
      FROM bags b
      JOIN stores s ON s.id = b.store_id
      WHERE ${where}
    `);

    const total = Number(count);

    return {
      items: rows.map(presentBagRow),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: offset + rows.length < total,
      },
    };
  }
}
