-- DropIndex
DROP INDEX "bags_title_trgm_idx";

-- DropIndex
DROP INDEX "stores_name_trgm_idx";

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "iban" TEXT,
ADD COLUMN     "iban_holder" TEXT,
ADD COLUMN     "legal_name" TEXT,
ADD COLUMN     "mersis_no" TEXT,
ADD COLUMN     "payout_ready" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "submerchant_key" TEXT,
ADD COLUMN     "tax_number" TEXT,
ADD COLUMN     "tax_office" TEXT;
