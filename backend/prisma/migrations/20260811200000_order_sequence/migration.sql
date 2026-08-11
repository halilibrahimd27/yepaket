-- İnsan tarafından okunabilir sipariş numarası (YP-001000) için dizi.
--
-- Neden dizi? Sipariş numarası benzersiz ve artan olmalı. "max(order_no)+1"
-- yaklaşımı eşzamanlı iki siparişte aynı numarayı üretir; dizi ise kilit
-- gerektirmeden benzersizliği garanti eder.
CREATE SEQUENCE IF NOT EXISTS order_no_seq START WITH 1000 INCREMENT BY 1;
