/**
 * Yasal metinlerde geçen şirket bilgileri.
 *
 * Tek yerde tutuluyor: aynı bilgi üç ayrı sayfada tekrarlandığında biri
 * güncellenmeden kalır ve yasal metinler tutarsızlaşır.
 *
 * ⚠️ TESLİM NOTU
 * Aşağıdaki değerler **doldurulmayı bekleyen yer tutuculardır**. Ticari
 * unvan, adres, MERSİS ve vergi bilgileri şirket kuruluş belgelerinden
 * alınıp buraya yazılmalıdır. Yayına çıkmadan önce doldurulmazsa yasal
 * metinler geçersiz olur ve mesafeli satış mevzuatına aykırı düşer.
 */
export const COMPANY = {
  /** Ticaret sicilinde kayıtlı tam unvan. */
  legalName: "[Şirket Ticari Unvanı A.Ş.]",

  /** Kullanıcıya görünen marka adı. */
  brandName: "YePaket",

  /** Ticaret sicilindeki merkez adresi. */
  address: "[Mahalle, Cadde, No, İlçe/İl]",

  mersis: "[MERSİS numarası]",
  taxOffice: "[Vergi dairesi]",
  taxNumber: "[Vergi numarası]",
  tradeRegistryNo: "[Ticaret sicil numarası]",

  phone: "[+90 XXX XXX XX XX]",

  /** Genel iletişim. */
  email: "merhaba@yepaket.app",
  /** KVKK başvuruları için ayrı adres — talepler karışmasın. */
  kvkkEmail: "kvkk@yepaket.app",
  /** Sipariş ve iade talepleri. */
  supportEmail: "destek@yepaket.app",

  /** Ödeme kuruluşunun ticari adı. */
  paymentProvider: "iyzico Ödeme Hizmetleri A.Ş.",

  /** Sunucuların bulunduğu bölge — KVKK aktarım bildirimi için gerekli. */
  hostingRegion: "Türkiye",
} as const;

/**
 * Yasal metinlerin son güncelleme tarihi.
 *
 * Metinlerde bir değişiklik yapıldığında burası da güncellenmelidir;
 * kullanıcı hangi sürümü kabul ettiğini bu tarihten anlar.
 */
export const LEGAL_UPDATED_AT = "17 Ağustos 2026";
