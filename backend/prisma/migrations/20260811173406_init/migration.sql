-- Eklentiler migration'ın parçasıdır: böylece boş bir veritabanında
-- (ör. CI servis konteyneri) da migration kendi kendine yeter.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CONSUMER', 'PARTNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('PASSWORD', 'GOOGLE', 'APPLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StoreMemberRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "BagCategory" AS ENUM ('BAKERY', 'MARKET', 'CAFE', 'RESTAURANT');

-- CreateEnum
CREATE TYPE "BagStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'SOLD_OUT', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PublishMode" AS ENUM ('ONCE', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PAYMENT_PENDING', 'PAID', 'PICKUP_PENDING', 'COLLECTED', 'CANCELLED', 'NO_SHOW', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BAG_AVAILABLE', 'ORDER_STATUS', 'PICKUP_REMINDER', 'IMPACT', 'CAMPAIGN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('ORDER', 'ACCOUNT', 'PAYMENT', 'PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "PartnerApplicationStatus" AS ENUM ('NEW', 'CONTACTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CONSUMER',
    "locale" TEXT NOT NULL DEFAULT 'tr-TR',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "email_verified_at" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "email" CITEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" TEXT,
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "push_token" TEXT,
    "app_version" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'tr-TR',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "BagCategory" NOT NULL,
    "description" TEXT,
    "phone" TEXT,
    "email" CITEXT,
    "address_line" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postal_code" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "logo_url" TEXT,
    "cover_url" TEXT,
    "status" "StoreStatus" NOT NULL DEFAULT 'PENDING',
    "commission_rate_bps" INTEGER NOT NULL DEFAULT 1200,
    "opening_time" TEXT,
    "closing_time" TEXT,
    "rating_average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "rescued_bag_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_members" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "StoreMemberRole" NOT NULL DEFAULT 'STAFF',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bag_templates" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" "BagCategory" NOT NULL,
    "description" TEXT,
    "image_urls" TEXT[],
    "original_value_minor" INTEGER NOT NULL,
    "sale_price_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "default_quantity" INTEGER NOT NULL,
    "pickup_start_minute" INTEGER NOT NULL,
    "pickup_end_minute" INTEGER NOT NULL,
    "publishMode" "PublishMode" NOT NULL DEFAULT 'ONCE',
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bag_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bags" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "template_id" UUID,
    "title" TEXT NOT NULL,
    "category" "BagCategory" NOT NULL,
    "description" TEXT,
    "image_urls" TEXT[],
    "original_value_minor" INTEGER NOT NULL,
    "sale_price_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "total_quantity" INTEGER NOT NULL,
    "available_quantity" INTEGER NOT NULL,
    "pickup_starts_at" TIMESTAMPTZ(3) NOT NULL,
    "pickup_ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "BagStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_no" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "bag_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_minor" INTEGER NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "commission_minor" INTEGER NOT NULL,
    "net_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" "OrderStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
    "pickup_starts_at" TIMESTAMPTZ(3) NOT NULL,
    "pickup_ends_at" TIMESTAMPTZ(3) NOT NULL,
    "pickup_code" TEXT NOT NULL,
    "pickup_nonce_hash" TEXT,
    "pickup_nonce_expires_at" TIMESTAMPTZ(3),
    "shared_token_hash" TEXT,
    "shared_token_expires_at" TIMESTAMPTZ(3),
    "reservation_expires_at" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),
    "collected_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "payout_id" UUID,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_payment_id" TEXT,
    "provider_status" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "refunded_amount_minor" INTEGER NOT NULL DEFAULT 0,
    "card_last_four" TEXT,
    "card_brand" TEXT,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "authorized_at" TIMESTAMPTZ(3),
    "captured_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "provider_refund_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ(3) NOT NULL,
    "period_end" TIMESTAMPTZ(3) NOT NULL,
    "gross_minor" BIGINT NOT NULL,
    "commission_minor" BIGINT NOT NULL,
    "refund_minor" BIGINT NOT NULL DEFAULT 0,
    "net_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMPTZ(3),
    "reference" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "overall" INTEGER NOT NULL,
    "food_quality" INTEGER,
    "pickup_experience" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "order_id" UUID,
    "name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "category" "SupportCategory" NOT NULL DEFAULT 'OTHER',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_applications" (
    "id" UUID NOT NULL,
    "business_name" TEXT NOT NULL,
    "business_type" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "note" TEXT,
    "status" "PartnerApplicationStatus" NOT NULL DEFAULT 'NEW',
    "created_store_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partner_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "user_id" UUID,
    "endpoint" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "meta" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_account_id_key" ON "oauth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "devices_push_token_idx" ON "devices"("push_token");

-- CreateIndex
CREATE UNIQUE INDEX "devices_user_id_device_id_key" ON "devices"("user_id", "device_id");

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE INDEX "stores_status_idx" ON "stores"("status");

-- CreateIndex
CREATE INDEX "stores_city_district_idx" ON "stores"("city", "district");

-- CreateIndex
CREATE INDEX "store_members_user_id_idx" ON "store_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_members_store_id_user_id_key" ON "store_members"("store_id", "user_id");

-- CreateIndex
CREATE INDEX "bag_templates_store_id_is_active_idx" ON "bag_templates"("store_id", "is_active");

-- CreateIndex
CREATE INDEX "bags_status_pickup_starts_at_idx" ON "bags"("status", "pickup_starts_at");

-- CreateIndex
CREATE INDEX "bags_store_id_pickup_starts_at_idx" ON "bags"("store_id", "pickup_starts_at");

-- CreateIndex
CREATE INDEX "bags_category_status_idx" ON "bags"("category", "status");

-- CreateIndex
CREATE INDEX "favorites_store_id_idx" ON "favorites"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_store_id_key" ON "favorites"("user_id", "store_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders"("order_no");

-- CreateIndex
CREATE INDEX "orders_user_id_status_idx" ON "orders"("user_id", "status");

-- CreateIndex
CREATE INDEX "orders_store_id_status_idx" ON "orders"("store_id", "status");

-- CreateIndex
CREATE INDEX "orders_bag_id_idx" ON "orders"("bag_id");

-- CreateIndex
CREATE INDEX "orders_status_reservation_expires_at_idx" ON "orders"("status", "reservation_expires_at");

-- CreateIndex
CREATE INDEX "orders_payout_id_idx" ON "orders"("payout_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_provider_payment_id_key" ON "payments"("provider", "provider_payment_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_store_id_period_start_period_end_key" ON "payouts"("store_id", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_order_id_key" ON "ratings"("order_id");

-- CreateIndex
CREATE INDEX "ratings_store_id_idx" ON "ratings"("store_id");

-- CreateIndex
CREATE INDEX "ratings_user_id_idx" ON "ratings"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_status_created_at_idx" ON "support_tickets"("status", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_user_id_idx" ON "support_tickets"("user_id");

-- CreateIndex
CREATE INDEX "partner_applications_status_created_at_idx" ON "partner_applications"("status", "created_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_endpoint_user_id_key" ON "idempotency_keys"("key", "endpoint", "user_id");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_created_at_idx" ON "outbox_events"("published_at", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_members" ADD CONSTRAINT "store_members_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_members" ADD CONSTRAINT "store_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bag_templates" ADD CONSTRAINT "bag_templates_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bags" ADD CONSTRAINT "bags_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bags" ADD CONSTRAINT "bags_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "bag_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_bag_id_fkey" FOREIGN KEY ("bag_id") REFERENCES "bags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================================
-- Alan kuralları (CHECK kısıtları)
--
-- Bunlar uygulama katmanındaki doğrulamanın tekrarı değil, son savunma
-- hattıdır: bir kod hatası, yarış durumu veya elle çalıştırılan SQL veriyi
-- tutarsız bırakamaz. Özellikle stok ve para alanlarında kritiktir.
-- ===========================================================================

-- Paket: stok negatife düşemez, toplamı aşamaz; indirimli fiyat normal
-- değerden büyük olamaz; teslim aralığı ileri yönlü olmalıdır.
ALTER TABLE "bags"
  ADD CONSTRAINT "bags_quantity_positive" CHECK ("total_quantity" > 0),
  ADD CONSTRAINT "bags_available_not_negative" CHECK ("available_quantity" >= 0),
  ADD CONSTRAINT "bags_available_within_total" CHECK ("available_quantity" <= "total_quantity"),
  ADD CONSTRAINT "bags_price_positive" CHECK ("sale_price_minor" > 0),
  ADD CONSTRAINT "bags_price_not_above_value" CHECK ("sale_price_minor" <= "original_value_minor"),
  ADD CONSTRAINT "bags_pickup_window_ordered" CHECK ("pickup_ends_at" > "pickup_starts_at");

-- Paket şablonu: gün içi dakika aralığı geçerli olmalı.
ALTER TABLE "bag_templates"
  ADD CONSTRAINT "bag_templates_quantity_positive" CHECK ("default_quantity" > 0),
  ADD CONSTRAINT "bag_templates_price_positive" CHECK ("sale_price_minor" > 0),
  ADD CONSTRAINT "bag_templates_price_not_above_value" CHECK ("sale_price_minor" <= "original_value_minor"),
  ADD CONSTRAINT "bag_templates_minutes_in_day" CHECK (
    "pickup_start_minute" >= 0 AND "pickup_start_minute" < 1440
    AND "pickup_end_minute" > 0 AND "pickup_end_minute" <= 1440
  ),
  ADD CONSTRAINT "bag_templates_minutes_ordered" CHECK ("pickup_end_minute" > "pickup_start_minute");

-- İşletme: koordinat sınırları, komisyon oranı ve puan aralığı.
ALTER TABLE "stores"
  ADD CONSTRAINT "stores_latitude_range" CHECK ("latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "stores_longitude_range" CHECK ("longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "stores_commission_range" CHECK ("commission_rate_bps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "stores_rating_range" CHECK ("rating_average" BETWEEN 0 AND 5),
  ADD CONSTRAINT "stores_rating_count_not_negative" CHECK ("rating_count" >= 0);

-- Sipariş: tutarlar birbiriyle tutarlı olmalı. Toplam = birim x adet,
-- net = toplam - komisyon. Bu kısıt sayesinde hatalı bir hesaplama
-- veritabanına yazılamaz.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "orders_unit_price_positive" CHECK ("unit_price_minor" > 0),
  ADD CONSTRAINT "orders_total_matches_line" CHECK ("total_minor" = "unit_price_minor" * "quantity"),
  ADD CONSTRAINT "orders_commission_range" CHECK ("commission_minor" >= 0 AND "commission_minor" <= "total_minor"),
  ADD CONSTRAINT "orders_net_matches" CHECK ("net_minor" = "total_minor" - "commission_minor"),
  ADD CONSTRAINT "orders_pickup_window_ordered" CHECK ("pickup_ends_at" > "pickup_starts_at");

-- Ödeme: iade toplamı çekilen tutarı aşamaz.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_positive" CHECK ("amount_minor" > 0),
  ADD CONSTRAINT "payments_refund_not_negative" CHECK ("refunded_amount_minor" >= 0),
  ADD CONSTRAINT "payments_refund_within_amount" CHECK ("refunded_amount_minor" <= "amount_minor");

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_amount_positive" CHECK ("amount_minor" > 0);

ALTER TABLE "payouts"
  ADD CONSTRAINT "payouts_amounts_not_negative" CHECK (
    "gross_minor" >= 0 AND "commission_minor" >= 0 AND "refund_minor" >= 0
  ),
  ADD CONSTRAINT "payouts_period_ordered" CHECK ("period_end" > "period_start");

-- Değerlendirme: puanlar 1-5 aralığında.
ALTER TABLE "ratings"
  ADD CONSTRAINT "ratings_overall_range" CHECK ("overall" BETWEEN 1 AND 5),
  ADD CONSTRAINT "ratings_food_quality_range" CHECK ("food_quality" IS NULL OR "food_quality" BETWEEN 1 AND 5),
  ADD CONSTRAINT "ratings_pickup_range" CHECK ("pickup_experience" IS NULL OR "pickup_experience" BETWEEN 1 AND 5);

-- ===========================================================================
-- Coğrafi ve arama indeksleri
-- ===========================================================================

-- "Yakınımdaki paketler" sorgusu için coğrafi indeks. Ayrı bir geography
-- kolonu tutmak yerine ifade indeksi kullanılır: lat/lng tek gerçek kaynak
-- olarak kalır, kopya veri senkronizasyon derdi doğurmaz.
CREATE INDEX "stores_location_gix" ON "stores"
  USING GIST ((ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography));

-- Yazım hatasına toleranslı işletme/paket araması.
CREATE INDEX "stores_name_trgm_idx" ON "stores" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "bags_title_trgm_idx" ON "bags" USING GIN ("title" gin_trgm_ops);

-- Keşif akışının sıcak yolu: yalnızca yayında ve stoğu olan paketler.
-- Kısmi indeks, tükenmiş ve süresi geçmiş kayıtları indeksin dışında tutar.
CREATE INDEX "bags_discovery_idx" ON "bags" ("pickup_starts_at")
  WHERE "status" = 'PUBLISHED'::"BagStatus" AND "available_quantity" > 0;
