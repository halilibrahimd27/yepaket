-- Veritabanı ilk kez oluşturulurken bir kez çalışır.
-- Migration'lar bu eklentilerin hazır olduğunu varsayar.

-- Coğrafi yakınlık sorguları (GET /bags/nearby) için.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Rastgele UUID üretimi ve kriptografik yardımcılar.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Mağaza ve paket adında yazım hatasına toleranslı arama için trigram indeksi.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Büyük/küçük harf duyarsız e-posta kolonları için.
CREATE EXTENSION IF NOT EXISTS citext;

-- Türkçe arama için 'unaccent' — "kahvaltı" ile "kahvalti" eşleşsin.
CREATE EXTENSION IF NOT EXISTS unaccent;
