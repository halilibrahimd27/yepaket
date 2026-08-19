import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { DateTime } from 'luxon';
import {
  BagCategory,
  BagStatus,
  PrismaClient,
  PublishMode,
  StoreStatus,
  UserRole,
} from '../src/generated/prisma/client';

/**
 * Geliştirme ve demo verisi.
 *
 * Tekrar çalıştırılabilir: her kayıt doğal anahtarı üzerinden upsert edilir,
 * böylece `npm run db:seed` iki kez çalışsa da kopya üretmez.
 *
 * Koordinatlar gerçek İstanbul adreslerine aittir; mesafeler artık sabit
 * metin değil, PostGIS ile kullanıcı konumundan hesaplanır.
 */

const ISTANBUL = 'Europe/Istanbul';
const DEMO_PASSWORD = 'demo1234';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Verilen yerel saat-dakikanın UTC karşılığı.
 *
 * `rollIfPast` verildiğinde, hesaplanan an çoktan geçmişse aynı saat ertesi
 * güne taşınır. Aksi hâlde seed akşam saatlerinde çalıştırıldığında tüm
 * paketlerin teslim aralığı geçmiş olur ve keşif listesi boş görünür.
 */
function localTimeToUtc(
  hour: number,
  minute: number,
  dayOffset = 0,
  rollIfPast = false,
): Date {
  let moment = DateTime.now()
    .setZone(ISTANBUL)
    .plus({ days: dayOffset })
    .set({ hour, minute, second: 0, millisecond: 0 });

  if (rollIfPast && moment <= DateTime.now()) {
    moment = moment.plus({ days: 1 });
  }

  return moment.toUTC().toJSDate();
}

const storeSeeds = [
  {
    slug: 'moda-firini',
    name: 'Moda Fırını',
    category: BagCategory.BAKERY,
    description: 'Mahallenin günlük ekşi mayalı ekmek, kruvasan ve tatlı durağı.',
    phone: '0216 555 42 42',
    email: 'iletisim@modafirini.example',
    addressLine: 'Caferağa Mah. Moda Cad. No:44',
    district: 'Kadıköy',
    city: 'İstanbul',
    latitude: 40.9855,
    longitude: 29.0265,
    openingTime: '07:30',
    closingTime: '21:30',
    ratingAverage: 4.8,
    ratingCount: 186,
    rescuedBagCount: 1284,
    bag: {
      title: 'Günün Fırın Paketi',
      description:
        'Gün içinde hazırlanan kruvasan, ekşi mayalı ekmek ve tatlılardan oluşan sürpriz paket.',
      image: 'bag-bakery.jpg',
      originalValueMinor: 42_000,
      salePriceMinor: 13_900,
      quantity: 3,
      pickup: [20, 0, 20, 30] as const,
      dayOffset: 0,
    },
  },
  {
    slug: 'mahalle-manavi',
    name: 'Mahalle Manavı',
    category: BagCategory.MARKET,
    description: 'Mevsiminde, yerel üreticiden gelen sebze ve meyve.',
    phone: '0212 555 18 18',
    email: 'iletisim@mahallemanavi.example',
    addressLine: 'Sinanpaşa Mah. Şair Nedim Cad. No:18',
    district: 'Beşiktaş',
    city: 'İstanbul',
    latitude: 41.0422,
    longitude: 29.0079,
    openingTime: '08:00',
    closingTime: '21:00',
    ratingAverage: 4.6,
    ratingCount: 94,
    rescuedBagCount: 612,
    bag: {
      title: 'Taze Sebze & Meyve',
      description: 'Görünümü kusursuz olmayabilir ama lezzeti yerinde mevsim sebze ve meyveleri.',
      image: 'bag-market.jpg',
      originalValueMinor: 35_000,
      salePriceMinor: 10_900,
      quantity: 5,
      pickup: [19, 30, 21, 0] as const,
      dayOffset: 0,
    },
  },
  {
    slug: 'kok-kahve',
    name: 'Kök Kahve',
    category: BagCategory.CAFE,
    description: 'Üçüncü nesil kahve, günlük sandviç ve tatlı.',
    phone: '0212 555 77 07',
    email: 'iletisim@kokkahve.example',
    addressLine: 'Kemankeş Karamustafapaşa Mah. Mumhane Cad. No:7',
    district: 'Beyoğlu',
    city: 'İstanbul',
    latitude: 41.0255,
    longitude: 28.977,
    openingTime: '08:00',
    closingTime: '22:00',
    ratingAverage: 4.9,
    ratingCount: 241,
    rescuedBagCount: 903,
    bag: {
      title: 'Kahve Yanı Sürprizi',
      description: 'Kapanışa doğru tezgahta kalan günlük kruvasan, sandviç ve tatlı seçenekleri.',
      image: 'bag-croissant.jpg',
      originalValueMinor: 39_000,
      salePriceMinor: 12_900,
      quantity: 2,
      pickup: [21, 0, 21, 30] as const,
      dayOffset: 0,
    },
  },
  {
    slug: 'mimoza-pastanesi',
    name: 'Mimoza Pastanesi',
    category: BagCategory.BAKERY,
    description: 'Günlük üretim kek, kurabiye ve porsiyon tatlılar.',
    phone: '0212 555 12 12',
    email: 'iletisim@mimozapastanesi.example',
    addressLine: 'Zeytinlik Mah. Yakut Sok. No:12',
    district: 'Bakırköy',
    city: 'İstanbul',
    latitude: 40.9782,
    longitude: 28.872,
    openingTime: '08:30',
    closingTime: '22:00',
    ratingAverage: 4.7,
    ratingCount: 132,
    rescuedBagCount: 445,
    bag: {
      title: 'Tatlı Kurtarma Paketi',
      description: 'Günlük üretimden kalan kek, kurabiye ve porsiyon tatlılardan seçki.',
      image: 'bag-pastries.jpg',
      originalValueMinor: 48_000,
      salePriceMinor: 14_900,
      quantity: 4,
      // Yarının paketi: istemcilerin "Yarın" etiketini doğru gösterdiğini
      // görebilmek için bilinçli olarak farklı bir güne konur.
      pickup: [20, 30, 21, 30] as const,
      dayOffset: 1,
    },
  },
];

async function main(): Promise<void> {
  // Teslim aralığı geçmiş ve hiç siparişi olmayan demo paketlerini temizle.
  // Seed birden çok kez çalıştırıldığında süresi dolmuş kayıtlar birikmesin;
  // sipariş almış olanlara dokunulmaz çünkü geçmiş veriyi bozmak istemeyiz.
  const removed = await prisma.bag.deleteMany({
    where: { pickupEndsAt: { lt: new Date() }, orders: { none: {} } },
  });
  if (removed.count > 0) {
    console.info(`Süresi dolmuş ${removed.count} demo paketi temizlendi.`);
  }

  const passwordHash = await hash(DEMO_PASSWORD);
  const assetBase = `${process.env.API_PUBLIC_URL ?? 'http://localhost:8080'}/static/bags`;

  const admin = await prisma.user.upsert({
    where: { email: 'admin@yepaket.app' },
    update: {},
    create: {
      email: 'admin@yepaket.app',
      name: 'YePaket Yönetici',
      passwordHash,
      role: UserRole.ADMIN,
      emailVerifiedAt: new Date(),
    },
  });

  const consumer = await prisma.user.upsert({
    where: { email: 'demo@yepaket.app' },
    update: {},
    create: {
      email: 'demo@yepaket.app',
      name: 'Eylül Kaya',
      phone: '0555 000 00 01',
      passwordHash,
      role: UserRole.CONSUMER,
      emailVerifiedAt: new Date(),
    },
  });

  const partner = await prisma.user.upsert({
    where: { email: 'demo@modafirini.com' },
    update: {},
    create: {
      email: 'demo@modafirini.com',
      name: 'Serkan Demir',
      phone: '0555 000 00 02',
      passwordHash,
      role: UserRole.PARTNER,
      emailVerifiedAt: new Date(),
    },
  });

  let favoriteStoreId: string | null = null;

  for (const seed of storeSeeds) {
    const { bag, ...storeData } = seed;

    const store = await prisma.store.upsert({
      where: { slug: seed.slug },
      update: {},
      create: {
        ...storeData,
        status: StoreStatus.APPROVED,
        commissionRateBps: Number(process.env.DEFAULT_COMMISSION_BPS ?? 1200),
        logoUrl: `${assetBase}/${bag.image}`,
        coverUrl: `${assetBase}/${bag.image}`,
      },
    });

    // Partner kullanıcısı yalnızca kendi işletmesini yönetir; diğer
    // işletmeler sahipsiz kalır ki yetki testleri anlamlı olsun.
    if (seed.slug === 'moda-firini') {
      await prisma.storeMember.upsert({
        where: { storeId_userId: { storeId: store.id, userId: partner.id } },
        update: {},
        create: { storeId: store.id, userId: partner.id, role: 'OWNER' },
      });
    }

    const [startHour, startMinute, endHour, endMinute] = bag.pickup;

    // BagTemplate ve Bag'in doğal anahtarı yok, bu yüzden upsert edilemezler.
    // Var olanı arayıp yoksa oluşturmak seed'i tekrar çalıştırılabilir kılar.
    const template =
      (await prisma.bagTemplate.findFirst({
        where: { storeId: store.id, title: bag.title },
      })) ??
      (await prisma.bagTemplate.create({
        data: {
          storeId: store.id,
          title: bag.title,
          category: seed.category,
          description: bag.description,
          imageUrls: [`${assetBase}/${bag.image}`],
          originalValueMinor: bag.originalValueMinor,
          salePriceMinor: bag.salePriceMinor,
          defaultQuantity: bag.quantity,
          pickupStartMinute: startHour * 60 + startMinute,
          pickupEndMinute: endHour * 60 + endMinute,
          publishMode: PublishMode.DAILY,
          isActive: true,
        },
      }));

    const rollIfPast = bag.dayOffset === 0;
    const pickupStartsAt = localTimeToUtc(startHour, startMinute, bag.dayOffset, rollIfPast);
    // Bitiş, başlangıçla aynı güne düşmeli: başlangıç ertesi güne kaydıysa
    // bitiş de kaymalı, yoksa aralık ters döner ve CHECK kısıtı reddeder.
    const pickupEndsAt = new Date(
      pickupStartsAt.getTime() + ((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) * 60_000,
    );
    const existingBag = await prisma.bag.findFirst({
      where: { storeId: store.id, pickupStartsAt },
    });

    if (!existingBag) {
      await prisma.bag.create({
        data: {
          storeId: store.id,
          templateId: template.id,
          title: bag.title,
          category: seed.category,
          description: bag.description,
          imageUrls: [`${assetBase}/${bag.image}`],
          originalValueMinor: bag.originalValueMinor,
          salePriceMinor: bag.salePriceMinor,
          totalQuantity: bag.quantity,
          availableQuantity: bag.quantity,
          pickupStartsAt,
          pickupEndsAt,
          status: BagStatus.PUBLISHED,
        },
      });
    }

    if (seed.slug === 'kok-kahve') favoriteStoreId = store.id;
  }

  await seedOrderHistory();

  if (favoriteStoreId) {
    await prisma.favorite.upsert({
      where: { userId_storeId: { userId: consumer.id, storeId: favoriteStoreId } },
      update: {},
      create: { userId: consumer.id, storeId: favoriteStoreId },
    });
  }

  const storeCount = await prisma.store.count();
  const bagCount = await prisma.bag.count();

  console.info(
    [
      'Seed tamamlandı:',
      `  kullanıcılar : ${admin.email}, ${consumer.email}, ${partner.email}`,
      `  şifre        : ${DEMO_PASSWORD}`,
      `  işletme      : ${storeCount}`,
      `  paket        : ${bagCount}`,
    ].join('\n'),
  );
}

/**
 * Geçmiş sipariş üretir.
 *
 * Etki sayaçları, panel grafikleri ve hakediş özeti tamamlanmış siparişlerden
 * hesaplanıyor. Bunlar olmadan demo kurulumda her sayaç sıfır görünür.
 */
async function seedOrderHistory(): Promise<void> {
  const consumer = await prisma.user.findUniqueOrThrow({
    where: { email: 'demo@yepaket.app' },
  });

  const existing = await prisma.order.count({
    where: { userId: consumer.id, status: 'COLLECTED' },
  });
  if (existing >= 40) return;

  const stores = await prisma.store.findMany({
    where: { status: 'APPROVED' },
    include: { bags: { take: 1, orderBy: { createdAt: 'desc' } } },
  });

  const [{ value: startNo }] = await prisma.$queryRaw<[{ value: bigint }]>`
    SELECT nextval('order_no_seq') AS value
  `;

  let counter = Number(startNo);
  const created: { storeId: string; bagId: string; day: number; qty: number }[] = [];

  // Son 30 güne yayılmış, günlere göre değişen hacim.
  for (let day = 1; day <= 30; day += 1) {
    const perDay = 1 + ((day * 7) % 3);
    for (let i = 0; i < perDay; i += 1) {
      const store = stores[(day + i) % stores.length];
      const bag = store.bags[0];
      if (!bag) continue;
      created.push({ storeId: store.id, bagId: bag.id, day, qty: 1 + ((day + i) % 2) });
    }
  }

  for (const item of created) {
    const store = stores.find((s) => s.id === item.storeId)!;
    const bag = store.bags[0];

    const collectedAt = new Date(Date.now() - item.day * 24 * 3600 * 1000);
    const unit = bag.salePriceMinor;
    const total = unit * item.qty;
    const commission = Math.round((total * store.commissionRateBps) / 10_000);

    await prisma.order.create({
      data: {
        orderNo: `YP-${String(counter++).padStart(6, '0')}`,
        userId: consumer.id,
        storeId: store.id,
        bagId: bag.id,
        quantity: item.qty,
        unitPriceMinor: unit,
        totalMinor: total,
        commissionMinor: commission,
        netMinor: total - commission,
        status: 'COLLECTED',
        pickupStartsAt: collectedAt,
        pickupEndsAt: new Date(collectedAt.getTime() + 30 * 60_000),
        pickupCode: String(100_000 + (counter % 900_000)),
        paidAt: collectedAt,
        collectedAt,
        createdAt: collectedAt,
      },
    });
  }

  // Mağaza sayaçlarını gerçek siparişlerle hizala.
  for (const store of stores) {
    const agg = await prisma.order.aggregate({
      where: { storeId: store.id, status: 'COLLECTED' },
      _sum: { quantity: true },
    });
    await prisma.store.update({
      where: { id: store.id },
      data: { rescuedBagCount: agg._sum.quantity ?? 0 },
    });
  }

  console.info(`  ${created.length} geçmiş sipariş üretildi.`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed başarısız:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
