import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "../components/LegalPage";
import { COMPANY, LEGAL_UPDATED_AT } from "../legal-data";

export const metadata: Metadata = {
  title: "Kullanım Koşulları ve Mesafeli Satış Sözleşmesi",
  description:
    "YePaket'i kullanırken geçerli olan kurallar, sipariş ve teslim şartları, iptal ve iade koşulları.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Kullanım Koşulları ve Mesafeli Satış Sözleşmesi"
      updatedAt={LEGAL_UPDATED_AT}
      intro={`Bu metin, ${COMPANY.brandName} platformunu kullanırken sizinle
        ${COMPANY.legalName} arasındaki kuralları belirler. Hesap oluşturarak
        veya sipariş vererek bu koşulları kabul etmiş olursunuz.`}
    >
      <LegalSection number={1} title="Taraflar ve tanımlar">
        <p>
          <strong>Platform / Aracı hizmet sağlayıcı:</strong>{" "}
          {COMPANY.legalName}, {COMPANY.address}. MERSİS: {COMPANY.mersis},
          Vergi dairesi/numarası: {COMPANY.taxOffice} / {COMPANY.taxNumber}.
        </p>
        <p>
          <strong>İşletme (satıcı):</strong> Sürpriz paketi hazırlayan ve
          teslim eden fırın, market, kafe veya restoran.
        </p>
        <p>
          <strong>Kullanıcı (alıcı):</strong> Platform üzerinden sipariş veren
          gerçek kişi.
        </p>
        <p>
          <strong>Sürpriz paket:</strong> İçeriği önceden tam olarak
          belirlenmemiş, işletmenin gün sonunda satılmadan kalan ürünlerinden
          oluşturduğu indirimli paket.
        </p>
      </LegalSection>

      <LegalSection number={2} title="Platformun rolü">
        <p>
          <strong>
            {COMPANY.brandName} bir aracı hizmet sağlayıcıdır, gıda satıcısı
            değildir.
          </strong>{" "}
          Ürünü hazırlayan, saklayan ve teslim eden taraf işletmedir. Gıda
          güvenliği, hijyen, içerik doğruluğu ve alerjen bilgisinden işletme
          sorumludur.
        </p>
        <p>
          Platform, işletmelerin ilanlarını yayınlar, ödemeyi tahsil eder ve
          işletmeye aktarır. Ödeme tutarından{" "}
          <strong>platform komisyonu</strong> düşülür; komisyon oranı işletmeyle
          yapılan ayrı sözleşmede belirlenir.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Hesap">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Hesap açmak için <strong>18 yaşını doldurmuş</strong> olmanız
            gerekir.
          </li>
          <li>
            Verdiğiniz bilgilerin doğruluğundan siz sorumlusunuz. Yanlış
            e-posta adresi sipariş bilgilerinin size ulaşmamasına yol açar.
          </li>
          <li>
            Şifrenizi kimseyle paylaşmayın. Hesabınızın izinsiz kullanıldığını
            fark ederseniz derhal şifrenizi değiştirin ve{" "}
            <a href={`mailto:${COMPANY.supportEmail}`}>
              {COMPANY.supportEmail}
            </a>{" "}
            adresine bildirin.
          </li>
          <li>
            Bir kişi tek hesap açabilir. Kampanyalardan haksız yararlanmak için
            açılan çoklu hesaplar kapatılır.
          </li>
        </ul>
      </LegalSection>

      <LegalSection number={4} title="Sipariş ve ödeme">
        <p>
          <strong>Sipariş nasıl kurulur:</strong> Paketi seçip ödemeyi
          tamamladığınızda sipariş kurulmuş sayılır. Ödeme onayı gelene kadar
          paket sizin adınıza <strong>15 dakika</strong> ayrılır; bu süre
          içinde ödeme tamamlanmazsa rezervasyon düşer ve paket yeniden satışa
          çıkar.
        </p>
        <p>
          <strong>Fiyat:</strong> Uygulamada görünen fiyat KDV dahildir. Ek
          hizmet bedeli veya teslim ücreti alınmaz.
        </p>
        <p>
          <strong>Ödeme:</strong> Ödeme, lisanslı ödeme kuruluşu{" "}
          {COMPANY.paymentProvider} altyapısı üzerinden alınır. Kart bilgileriniz
          platformun sunucularına hiç ulaşmaz ve saklanmaz.
        </p>
        <p>
          <strong>Fatura:</strong> Satış işletme tarafından yapıldığı için fatura
          da işletme tarafından düzenlenir. Faturayı sipariş detayından veya
          teslim sırasında talep edebilirsiniz.
        </p>
      </LegalSection>

      <LegalSection number={5} title="Sürpriz paketin içeriği">
        <p>
          Paketin içeriği <strong>önceden tam olarak bilinmez</strong> — ürünün
          doğası budur. İşletme, paketin kategorisini (fırın, market, kafe,
          restoran) ve içerebileceği ürün tipini belirtir; o gün hangi ürünlerin
          kaldığına göre içerik değişir.
        </p>
        <p>
          Belirtilen <strong>normal değer</strong> işletmenin bildirdiği tahmini
          perakende tutardır. Paketin içindeki ürünlerin toplam değeri bu tutarın
          altında veya üstünde olabilir.
        </p>
        <p>
          <strong>Alerjen uyarısı:</strong> İçerik önceden kesin bilinmediği
          için, ciddi gıda alerjiniz varsa sipariş vermeden önce işletmeyle
          iletişime geçmenizi öneririz. Alerjen bilgisinin doğruluğundan işletme
          sorumludur.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Teslim">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Paketi, ilanda belirtilen <strong>teslim aralığında</strong>{" "}
            işletmeden kendiniz teslim alırsınız. Kargo veya kurye yoktur.
          </li>
          <li>
            Teslim sırasında uygulamadaki teslim kodunu veya kaydırma onayını
            gösterirsiniz.
          </li>
          <li>
            Aralığı kaçırırsanız işletme paketi başkasına verebilir veya imha
            edebilir; bu durumda <strong>iade yapılmaz</strong>. Paket sizin için
            ayrıldığı ve kısa ömürlü olduğu için bu kural zorunludur.
          </li>
          <li>
            Sizin adınıza başkası teslim alabilir; uygulamadaki &ldquo;arkadaşına
            gönder&rdquo; özelliğiyle tek kullanımlık teslim bağlantısı
            üretebilirsiniz.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="7" number={7} title="İptal ve iade">
        <p>
          <strong>Ücretsiz iptal:</strong> Teslim aralığının başlangıcına{" "}
          <strong>2 saat veya daha fazla</strong> varsa siparişi uygulamadan
          iptal edebilirsiniz. Ödemeniz iade edilir.
        </p>
        <p>
          <strong>Son 2 saat:</strong> Bu süreden sonra iptal edilemez.
          İşletme ürünü sizin için ayırmış ve satıştan çekmiştir.
        </p>
        <p>
          <strong>Cayma hakkı istisnası:</strong> Mesafeli Sözleşmeler
          Yönetmeliği m.15/1-(ç) uyarınca çabuk bozulan veya son kullanma tarihi
          geçebilecek mallarda cayma hakkı kullanılamaz. Sürpriz paketler bu
          kapsamdadır.
        </p>
        <p>
          <strong>Paket teslim edilmezse:</strong> İşletme paketi hazırlamamış
          veya kapalıysa tutarın tamamı iade edilir. Bu durumu{" "}
          <Link href="/destek">destek talebi</Link> ile bildirin.
        </p>
        <p>
          <strong>Ürün ayıplıysa:</strong> Bozulmuş, son kullanma tarihi geçmiş
          veya ilanla açıkça uyuşmayan ürün aldıysanız, teslimden itibaren{" "}
          <strong>24 saat içinde</strong> fotoğrafla birlikte bildirin. İnceleme
          sonucunda haklı bulunursa iade yapılır.
        </p>
        <p>
          <strong>İade süresi:</strong> İadeler ödeme kuruluşuna bildirildikten
          sonra bankanıza bağlı olarak <strong>3–10 iş günü</strong> içinde
          kartınıza yansır.
        </p>
      </LegalSection>

      <LegalSection number={8} title="Kullanıcı yükümlülükleri">
        <p>Platformu kullanırken şunları yapmamayı kabul edersiniz:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Başkasının hesabını veya ödeme aracını izinsiz kullanmak</li>
          <li>
            Sipariş verip düzenli olarak teslim almamak (işletmeye ve platforma
            zarar verir)
          </li>
          <li>Gerçeğe aykırı değerlendirme veya şikâyet bırakmak</li>
          <li>
            Platformu otomatik araçlarla taramak, tersine mühendislik yapmak
            veya aşırı yük bindirmek
          </li>
          <li>Aldığınız paketleri ticari amaçla yeniden satmak</li>
        </ul>
        <p>
          Bu kuralların ihlali hâlinde hesabınız uyarı yapılarak veya ağır
          hâllerde doğrudan askıya alınabilir.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Sorumluluk sınırı">
        <p>
          Platform, işletmenin hazırladığı ürünün kalitesi, gıda güvenliği ve
          içeriğinden doğrudan sorumlu değildir; sorumluluk satıcı işletmeye
          aittir. Platformun sorumluluğu her hâlükârda{" "}
          <strong>ilgili siparişin bedeli</strong> ile sınırlıdır.
        </p>
        <p>
          Bu sınırlama, tüketici mevzuatından doğan haklarınızı ve platformun
          kendi kusurundan doğan sorumluluğunu ortadan kaldırmaz.
        </p>
        <p>
          Hizmet &ldquo;olduğu gibi&rdquo; sunulur; kesintisiz çalışacağı
          garanti edilmez. Planlı bakımları önceden duyururuz.
        </p>
      </LegalSection>

      <LegalSection number={10} title="Fikri mülkiyet">
        <p>
          {COMPANY.brandName} markası, logosu, arayüz tasarımı ve yazılımı{" "}
          {COMPANY.legalName}&apos;ye aittir. İşletme ve ürün görselleri ilgili
          işletmeye aittir. İzinsiz kopyalanamaz ve ticari amaçla kullanılamaz.
        </p>
      </LegalSection>

      <LegalSection number={11} title="Değişiklikler">
        <p>
          Bu koşulları güncelleyebiliriz. Önemli değişiklikleri yürürlüğe
          girmeden en az <strong>15 gün önce</strong> uygulama içinde ve e-posta
          ile duyururuz. Değişiklikten sonra platformu kullanmaya devam etmeniz
          yeni koşulları kabul ettiğiniz anlamına gelir.
        </p>
      </LegalSection>

      <LegalSection number={12} title="Uyuşmazlık çözümü">
        <p>
          Öncelikle{" "}
          <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>{" "}
          adresinden bize ulaşmanızı rica ederiz; sorunların büyük bölümü bu
          aşamada çözülür.
        </p>
        <p>
          Çözülemeyen uyuşmazlıklarda, parasal sınırlar dâhilinde{" "}
          <strong>İlçe/İl Tüketici Hakem Heyetleri</strong> ve{" "}
          <strong>Tüketici Mahkemeleri</strong> yetkilidir. Güncel parasal
          sınırlar Ticaret Bakanlığı tarafından her yıl ilan edilir.
        </p>
        <p>
          Bu sözleşmeye Türkiye Cumhuriyeti hukuku uygulanır.
        </p>
        <p className="pt-4">
          <Link
            href="/gizlilik"
            className="font-extrabold text-[var(--forest)] underline underline-offset-4"
          >
            Gizlilik Politikası ve KVKK metnini de okuyun →
          </Link>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
