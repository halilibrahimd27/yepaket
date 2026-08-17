-- İnsan tarafından okunabilir destek talebi numarası (DT-000123) için dizi.
--
-- Sipariş numarasıyla aynı gerekçe: eşzamanlı iki talep "max+1" ile aynı
-- numarayı alırdı; dizi kilit gerektirmeden benzersizliği garanti eder.
CREATE SEQUENCE IF NOT EXISTS support_ticket_no_seq START WITH 1000 INCREMENT BY 1;

-- Mevcut kayıtlara numara verilir.
--
-- Kolon önce boş bırakılıp doldurulur, sonra NOT NULL yapılır: doğrudan
-- NOT NULL eklemek mevcut satırlar yüzünden başarısız olurdu.
ALTER TABLE "support_tickets" ADD COLUMN "ticket_no" TEXT;

UPDATE "support_tickets"
SET "ticket_no" = 'DT-' || LPAD(nextval('support_ticket_no_seq')::TEXT, 6, '0')
WHERE "ticket_no" IS NULL;

ALTER TABLE "support_tickets" ALTER COLUMN "ticket_no" SET NOT NULL;

CREATE UNIQUE INDEX "support_tickets_ticket_no_key" ON "support_tickets"("ticket_no");
