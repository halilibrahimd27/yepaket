import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "../components/LegalPage";
import { COMPANY, LEGAL_UPDATED_AT } from "../legal-data";

export const metadata: Metadata = {
  title: "Gizlilik Politikası ve KVKK Aydınlatma Metni",
  description:
    "YePaket olarak hangi kişisel verileri, hangi amaçla işlediğimizi ve haklarınızı nasıl kullanabileceğinizi açıklıyoruz.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Gizlilik Politikası ve KVKK Aydınlatma Metni"
      updatedAt={LEGAL_UPDATED_AT}
      intro={`${COMPANY.legalName} olarak kişisel verilerinizi 6698 sayılı Kişisel
        Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu sıfatıyla
        işliyoruz. Bu metin, hangi verileri neden topladığımızı, kimlerle
        paylaştığımızı ve haklarınızı nasıl kullanabileceğinizi anlatır.`}
    >
      <LegalSection number={1} title="Veri sorumlusu">
        <p>
          <strong>{COMPANY.legalName}</strong>
          <br />
          Adres: {COMPANY.address}
          <br />
          MERSİS: {COMPANY.mersis}
          <br />
          Vergi dairesi / numarası: {COMPANY.taxOffice} / {COMPANY.taxNumber}
          <br />
          KVKK başvuruları:{" "}
          <a href={`mailto:${COMPANY.kvkkEmail}`}>{COMPANY.kvkkEmail}</a>
        </p>
      </LegalSection>

      <LegalSection number={2} title="İşlediğimiz kişisel veriler">
        <p>
          Yalnızca hizmeti sunmak için gereken verileri topluyoruz. Aşağıda
          listelenmeyen bir veri kategorisi işlemiyoruz.
        </p>

        <h3 className="pt-2 font-extrabold text-[var(--forest)]">
          Hesap oluşturduğunuzda
        </h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Ad soyad, e-posta adresi</li>
          <li>Şifreniz (geri döndürülemez şekilde şifrelenir — Argon2id)</li>
          <li>
            Sosyal hesapla giriş yaparsanız: sağlayıcının bize verdiği ad,
            e-posta ve hesap kimliği
          </li>
          <li>İsteğe bağlı: telefon numarası, profil görseli</li>
        </ul>

        <h3 className="pt-2 font-extrabold text-[var(--forest)]">
          Uygulamayı kullandığınızda
        </h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Sipariş geçmişi, teslim kayıtları, değerlendirmeleriniz</li>
          <li>Favori işletmeleriniz ve bildirim tercihleriniz</li>
          <li>
            Konum bilgisi — <strong>yalnızca izin verdiğinizde</strong> ve
            yakınınızdaki paketleri listelemek için. Konumunuz saklanmaz,
            sorgu anında kullanılıp atılır.
          </li>
          <li>
            Cihaz bilgisi (işletim sistemi, uygulama sürümü, cihaz kimliği) ve
            push bildirim jetonu
          </li>
          <li>
            IP adresi, tarayıcı bilgisi ve oturum kayıtları — güvenlik ve
            kötüye kullanım incelemesi için
          </li>
        </ul>

        <h3 className="pt-2 font-extrabold text-[var(--forest)]">
          Ödeme yaptığınızda
        </h3>
        <p>
          <strong>Kart bilgileriniz bize hiç ulaşmaz.</strong> Ödeme, lisanslı
          ödeme kuruluşu {COMPANY.paymentProvider} tarafından kendi güvenli
          sayfasında alınır. Bizde yalnızca işlem numarası, tutar, sonuç ve
          kartın son dört hanesi ile markası saklanır.
        </p>
      </LegalSection>

      <LegalSection number={3} title="İşleme amaçları ve hukuki sebepler">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left">
                <th className="py-3 pr-4 font-extrabold">Amaç</th>
                <th className="py-3 pr-4 font-extrabold">Veri</th>
                <th className="py-3 font-extrabold">Hukuki sebep (KVKK m.5)</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {[
                [
                  "Üyelik ve oturum yönetimi",
                  "Kimlik, iletişim, oturum",
                  "Sözleşmenin kurulması ve ifası",
                ],
                [
                  "Sipariş, ödeme ve teslim",
                  "Sipariş, işlem, teslim kaydı",
                  "Sözleşmenin ifası",
                ],
                [
                  "Fatura ve muhasebe kayıtları",
                  "Kimlik, işlem",
                  "Hukuki yükümlülük (VUK, TTK)",
                ],
                [
                  "Yakındaki paketleri gösterme",
                  "Konum",
                  "Açık rıza",
                ],
                [
                  "Push bildirimi ve kampanya iletisi",
                  "İletişim, cihaz jetonu",
                  "Açık rıza (istediğiniz an kapatabilirsiniz)",
                ],
                [
                  "Dolandırıcılık ve kötüye kullanım önleme",
                  "IP, cihaz, oturum",
                  "Meşru menfaat",
                ],
                [
                  "Destek taleplerinin yanıtlanması",
                  "İletişim, talep içeriği",
                  "Sözleşmenin ifası / meşru menfaat",
                ],
              ].map(([amac, veri, sebep]) => (
                <tr key={amac} className="border-b border-black/5">
                  <td className="py-3 pr-4">{amac}</td>
                  <td className="py-3 pr-4 text-black/60">{veri}</td>
                  <td className="py-3 text-black/60">{sebep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection number={4} title="Verilerin aktarıldığı taraflar">
        <p>
          Kişisel verilerinizi satmıyoruz ve pazarlama amacıyla üçüncü
          taraflara vermiyoruz. Yalnızca hizmetin çalışması için gerekli
          aktarımları yapıyoruz:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Sipariş verdiğiniz işletme:</strong> adınızın baş harfleri,
            sipariş numarası ve teslim bilgisi. İşletme e-postanızı veya
            telefonunuzu görmez.
          </li>
          <li>
            <strong>Ödeme kuruluşu ({COMPANY.paymentProvider}):</strong> ödeme
            işleminin gerektirdiği bilgiler.
          </li>
          <li>
            <strong>E-posta ve bildirim altyapısı:</strong> ileti gönderimi için
            gereken adres ve içerik.
          </li>
          <li>
            <strong>Yetkili kamu kurumları:</strong> yalnızca hukuken zorunlu
            hâllerde ve talep edilen kapsamda.
          </li>
        </ul>
        <p>
          Sunucularımız {COMPANY.hostingRegion} bölgesindedir. Bildirim
          altyapısı (Firebase) yurt dışında barındırıldığı için push bildirimi
          açtığınızda cihaz jetonunuz yurt dışına aktarılır; bu aktarım açık
          rızanıza dayanır ve bildirimleri kapatarak durdurabilirsiniz.
        </p>
      </LegalSection>

      <LegalSection number={5} title="Saklama süreleri">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Hesap verileri:</strong> hesabınız açık olduğu sürece.
            Hesabınızı kapattığınızda kimlik ve iletişim bilgileriniz
            anonimleştirilir.
          </li>
          <li>
            <strong>Sipariş, ödeme ve fatura kayıtları:</strong> vergi
            mevzuatı gereği <strong>10 yıl</strong>. Bu kayıtlar hesabınızı
            kapatsanız da silinmez ama artık kimliğinizle ilişkilendirilemez.
          </li>
          <li>
            <strong>Oturum ve güvenlik kayıtları:</strong> 90 gün.
          </li>
          <li>
            <strong>Destek yazışmaları:</strong> talebin kapanmasından itibaren
            2 yıl.
          </li>
        </ul>
      </LegalSection>

      <LegalSection number={6} title="Haklarınız">
        <p>KVKK m.11 uyarınca bize başvurarak şunları talep edebilirsiniz:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Kişisel verinizin işlenip işlenmediğini öğrenme</li>
          <li>İşlenmişse buna ilişkin bilgi talep etme</li>
          <li>İşleme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
          <li>Yurt içinde veya dışında aktarıldığı üçüncü kişileri bilme</li>
          <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
          <li>Silinmesini veya yok edilmesini isteme</li>
          <li>
            Otomatik sistemlerle analiz sonucu aleyhinize bir sonuç doğmasına
            itiraz etme
          </li>
          <li>Kanuna aykırı işleme nedeniyle zararınızın giderilmesini isteme</li>
        </ul>
        <p>
          Başvurunuzu{" "}
          <a href={`mailto:${COMPANY.kvkkEmail}`}>{COMPANY.kvkkEmail}</a>{" "}
          adresine ya da yukarıdaki posta adresine iletebilirsiniz. En geç{" "}
          <strong>30 gün</strong> içinde yanıtlıyoruz. Hesabınızı uygulama
          içinden <em>Ayarlar → Hesabı kapat</em> yolundan da silebilirsiniz.
        </p>
      </LegalSection>

      <LegalSection number={7} title="Veri güvenliği">
        <ul className="list-disc space-y-1 pl-5">
          <li>Tüm trafik TLS ile şifrelenir; şifresiz bağlantı kabul edilmez.</li>
          <li>
            Şifreler Argon2id ile geri döndürülemez şekilde saklanır; düz metin
            şifreyi biz de göremeyiz.
          </li>
          <li>
            Oturum jetonları sunucuda yalnızca özet (hash) olarak tutulur ve her
            kullanımda yenilenir. Çalınmış bir jeton ikinci kez kullanıldığında
            o cihazın tüm oturumları kapatılır.
          </li>
          <li>Veritabanı yedekleri şifrelenir ve erişim kayıt altına alınır.</li>
        </ul>
      </LegalSection>

      <LegalSection id="cerezler" number={8} title="Çerezler">
        <p>
          Reklam veya takip çerezi kullanmıyoruz. Sitede yalnızca hizmetin
          çalışması için <strong>zorunlu çerezler</strong> bulunur:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left">
                <th className="py-3 pr-4 font-extrabold">Çerez</th>
                <th className="py-3 pr-4 font-extrabold">Amaç</th>
                <th className="py-3 font-extrabold">Süre</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black/5">
                <td className="py-3 pr-4 font-mono text-xs">yp_access</td>
                <td className="py-3 pr-4 text-black/60">Oturum doğrulama</td>
                <td className="py-3 text-black/60">15 dakika</td>
              </tr>
              <tr className="border-b border-black/5">
                <td className="py-3 pr-4 font-mono text-xs">yp_refresh</td>
                <td className="py-3 pr-4 text-black/60">
                  Oturumun sürekliliği
                </td>
                <td className="py-3 text-black/60">60 gün</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Her iki çerez de <code>httpOnly</code> işaretlidir: sayfadaki
          JavaScript bunları okuyamaz, dolayısıyla siteye sızan bir betik
          oturumunuzu çalamaz. Zorunlu oldukları için onay istemiyoruz; ancak
          tarayıcı ayarlarınızdan engellerseniz giriş yapamazsınız.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Çocukların verileri">
        <p>
          Hizmetimiz 18 yaşından küçükler için tasarlanmamıştır. 18 yaşından
          küçük birine ait veri işlediğimizi fark edersek kaydı sileriz. Böyle
          bir durumu fark ederseniz{" "}
          <a href={`mailto:${COMPANY.kvkkEmail}`}>{COMPANY.kvkkEmail}</a>{" "}
          adresine bildirin.
        </p>
      </LegalSection>

      <LegalSection number={10} title="Bu metindeki değişiklikler">
        <p>
          Metni güncellediğimizde sayfanın üstündeki tarihi değiştiririz. Önemli
          bir değişiklik olduğunda uygulama içinde ve e-posta ile bilgilendiririz.
        </p>
        <p className="pt-4">
          <Link
            href="/kosullar"
            className="font-extrabold text-[var(--forest)] underline underline-offset-4"
          >
            Kullanım Koşulları’nı da okuyun →
          </Link>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
