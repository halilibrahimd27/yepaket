# Yerel geliştirme altyapısı

Backend'in ihtiyaç duyduğu servisleri Docker ile ayağa kaldırır. Uygulama
kodunun kendisi container'da değil, doğrudan makinenizde çalışır — böylece
hot reload ve hata ayıklama sorunsuz olur.

## Kullanım

```bash
cp .env.example .env
docker compose up -d          # başlat
docker compose ps             # durum
docker compose logs -f postgres
docker compose down           # durdur (veri kalır)
docker compose down -v        # durdur ve TÜM veriyi sil
```

## Servisler

| Servis | Adres | Not |
| --- | --- | --- |
| PostgreSQL 17 + PostGIS | `localhost:5432` | Kullanıcı/şifre/veritabanı: `.env` |
| Redis 7 | `localhost:6379` | Cache, rate limit, idempotency, pub/sub |
| Mailpit (SMTP) | `localhost:1025` | Backend buraya e-posta gönderir |
| Mailpit (arayüz) | http://localhost:8025 | Gönderilen e-postaları tarayıcıda görün |

Port çakışması yaşarsanız `.env` içindeki `*_PORT` değerlerini değiştirin ve
`backend/.env` içindeki bağlantı adreslerini de aynı şekilde güncelleyin.

## Notlar

- PostgreSQL ilk açılışta `postgres/init/` altındaki SQL dosyalarını çalıştırır
  ve gerekli eklentileri (`postgis`, `pgcrypto`, `pg_trgm`, `citext`,
  `unaccent`) kurar. Bu dosyalar **yalnızca veri klasörü boşken** çalışır;
  değiştirdiyseniz `docker compose down -v` ile sıfırlayın.
- Redis `noeviction` politikasıyla çalışır: idempotency kayıtları bellek
  dolduğunda sessizce silinmemelidir.
- Veriler adlandırılmış Docker volume'larında tutulur, depo dizinine yazılmaz.
