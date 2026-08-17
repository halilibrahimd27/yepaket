"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  Clock3,
  Coins,
  Leaf,
  PackagePlus,
  ShieldCheck,
  Sparkles,
  Store,
  UsersRound,
} from "lucide-react";
import { FormEvent, useLayoutEffect, useRef, useState } from "react";
import { PublicFooter } from "./PublicFooter";
import { PublicHeader } from "./PublicHeader";

gsap.registerPlugin(ScrollTrigger);

export function BusinessPage() {
  const root = useRef<HTMLDivElement>(null);
  const [bags, setBags] = useState(8);
  const [value, setValue] = useState(390);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthly = Math.round(bags * value * 0.34 * 26);

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      gsap.from("[data-business-hero] > *", { y: 28, opacity: 0, duration: .8, stagger: .1, ease: "power3.out" });
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
        gsap.from(element, { y: 30, opacity: 0, duration: .7, scrollTrigger: { trigger: element, start: "top 86%", once: true } });
      });
    }, root);
    return () => context.revert();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSending(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "partner-application",
          payload: {
            businessName: String(form.get("businessName") ?? ""),
            businessType: String(form.get("businessType") ?? ""),
            contactName: String(form.get("contactName") ?? ""),
            phone: String(form.get("phone") ?? ""),
            email: String(form.get("email") ?? ""),
            city: String(form.get("city") ?? ""),
            district: String(form.get("district") ?? ""),
          },
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(body.error?.message ?? "Başvuru gönderilemedi. Lütfen tekrar deneyin.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div ref={root} className="bg-[var(--cream)] text-[var(--ink)]">
      <PublicHeader />
      <main>
        <section className="px-5 pb-24 pt-32 lg:px-8 lg:pb-32 lg:pt-40">
          <div className="mx-auto grid max-w-[1240px] items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
            <div data-business-hero>
              <div className="eyebrow"><Sparkles size={15} /> İşletmeler için YePaket</div>
              <h1 className="mt-7 text-[clamp(3.5rem,6.6vw,6.8rem)] font-black leading-[.9] tracking-[-.07em] text-[var(--forest)]">
                Fazlanı<br /><span className="text-[var(--lime-dark)]">kazanca</span> çevir.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
                Gün sonunda kalan iyi yemekleri sürpriz paket olarak yayınla; yeni müşteriler kazan, maliyetini azalt, etkini büyüt.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="#basvuru" className="brand-button justify-center px-7 py-4">Ücretsiz başvur <ArrowRight size={18} /></a>
                <a href="/giris" className="soft-button justify-center px-7 py-4">MyStore’a giriş</a>
              </div>
              <div className="mt-9 flex flex-wrap gap-5 text-sm font-bold text-[var(--forest)]">
                <span className="inline-flex items-center gap-2"><Check size={17} className="text-[var(--lime-dark)]" /> Kurulum ücreti yok</span>
                <span className="inline-flex items-center gap-2"><Check size={17} className="text-[var(--lime-dark)]" /> Esnek yayın</span>
                <span className="inline-flex items-center gap-2"><Check size={17} className="text-[var(--lime-dark)]" /> Aylık ödeme</span>
              </div>
            </div>

            <div className="rounded-[38px] bg-[var(--forest)] p-6 text-white shadow-[0_34px_80px_rgba(6,40,31,.2)] sm:p-8">
              <span className="text-sm font-black uppercase tracking-[.15em] text-[var(--lime)]">Gelir tahmini</span>
              <h2 className="mt-3 text-3xl font-black tracking-[-.04em]">Çöpe değil, kasaya.</h2>
              <div className="mt-8 space-y-7">
                <div className="block"><span className="flex justify-between text-sm"><b>Günlük paket</b><strong>{bags} adet</strong></span><input aria-label="Günlük paket sayısı" id="daily-bags" type="range" min="1" max="30" value={bags} onChange={(event) => setBags(Number(event.target.value))} className="mt-4 w-full accent-[var(--lime)]" /></div>
                <div className="block"><span className="flex justify-between text-sm"><b>Ortalama normal değer</b><strong>{value} ₺</strong></span><input aria-label="Ortalama normal değer" id="average-value" type="range" min="150" max="1200" step="10" value={value} onChange={(event) => setValue(Number(event.target.value))} className="mt-4 w-full accent-[var(--lime)]" /></div>
              </div>
              <div className="mt-8 rounded-[28px] bg-white p-6 text-[var(--forest)]">
                <span className="text-xs font-bold uppercase tracking-[.14em] text-[var(--muted)]">Tahmini aylık ek ciro</span>
                <strong className="mt-2 block text-5xl font-black tracking-[-.06em]">{monthly.toLocaleString("tr-TR")} ₺</strong>
                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">26 satış günü ve normal değerin yaklaşık %34’ü üzerinden demo hesaplama.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-24 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1240px]">
            <div data-reveal className="mx-auto max-w-2xl text-center"><div className="eyebrow mx-auto"><Store size={15} /> Her ölçek için</div><h2 className="section-title mt-6">İşletmene iyi,<br />gezegene daha iyi.</h2></div>
            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Coins, title: "Ek gelir", text: "Satılmayan üründen düzenli ve ölçülebilir gelir yarat." },
                { icon: UsersRound, title: "Yeni müşteri", text: "Mahallende seni henüz keşfetmemiş kullanıcılara ulaş." },
                { icon: BarChart3, title: "Net içgörü", text: "Paket, satış, teslim ve hakediş verilerini tek yerde izle." },
                { icon: Leaf, title: "Gerçek etki", text: "Önlediğin CO₂e ve gıda israfını raporla, ekibinle paylaş." },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} data-reveal className="rounded-[30px] border border-black/5 bg-[var(--cream)] p-7"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--forest)] text-[var(--lime)]"><Icon size={24} /></div><h3 className="mt-7 text-xl font-black text-[var(--forest)]">{title}</h3><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{text}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-[1240px]">
            <div data-reveal className="grid overflow-hidden rounded-[40px] bg-[var(--lime)] lg:grid-cols-[.8fr_1.2fr]">
              <div className="p-8 sm:p-12 lg:p-14"><span className="text-xs font-black uppercase tracking-[.16em] text-[var(--forest)]/55">Dört adımda yayında</span><h2 className="mt-4 text-4xl font-black tracking-[-.055em] text-[var(--forest)] sm:text-5xl">Bugünün fazlası,<br />bugünün fırsatı.</h2><p className="mt-5 leading-7 text-[var(--forest)]/65">Paketlerini her gün elle açabilir veya tekrar eden takvim kurabilirsin.</p></div>
              <div className="grid gap-px bg-[var(--forest)]/10 sm:grid-cols-2">
                {[
                  [PackagePlus, "01", "Paketini oluştur", "Kategori, tahmini içerik, değer ve satış fiyatını belirle."],
                  [Clock3, "02", "Saatini seç", "İşletmene uygun teslim alma aralığını tanımla."],
                  [UsersRound, "03", "Siparişleri hazırla", "Kaç paketin rezerve edildiğini canlı takip et."],
                  [ShieldCheck, "04", "Teslim et & kazan", "Müşteri kaydırdığında sipariş tamamlanır."],
                ].map(([Icon, number, title, text]) => {
                  const StepIcon = Icon as typeof PackagePlus;
                  return <div key={String(number)} className="bg-[var(--lime)] p-8 sm:p-10"><StepIcon size={25} className="text-[var(--forest)]" /><span className="mt-10 block text-xs font-black text-[var(--forest)]/45">{String(number)}</span><h3 className="mt-2 text-xl font-black text-[var(--forest)]">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-[var(--forest)]/65">{String(text)}</p></div>;
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="basvuru" className="bg-white px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto grid max-w-[1100px] gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div data-reveal><div className="eyebrow"><BadgeCheck size={15} /> Ücretsiz ön kayıt</div><h2 className="section-title mt-6">İşletmeni<br />YePaket’e ekle.</h2><p className="mt-6 leading-7 text-[var(--muted)]">Ekibimiz bilgilerini inceleyip demo kurulum için seninle iletişime geçsin.</p></div>
            <div data-reveal className="rounded-[34px] bg-[var(--cream)] p-6 sm:p-9">
              {submitted ? (
                <div className="grid min-h-[380px] place-items-center text-center"><div><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[var(--lime)] text-[var(--forest)]"><Check size={34} /></div><h3 className="mt-6 text-3xl font-black text-[var(--forest)]">Başvurun alındı!</h3><p className="mx-auto mt-3 max-w-sm leading-7 text-[var(--muted)]">Ekibimiz bilgilerini inceleyip en kısa sürede seninle iletişime geçecek. Başvuru onayı e-posta ile bildirilecek.</p></div></div>
              ) : (
                <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                  <label className="form-label">İşletme adı<input required name="businessName" className="form-input" placeholder="Örn. Moda Fırını" /></label>
                  <label className="form-label">İşletme türü<select name="businessType" className="form-input"><option>Fırın / Pastane</option><option>Kafe</option><option>Restoran</option><option>Market</option></select></label>
                  <label className="form-label">Yetkili adı<input required name="contactName" className="form-input" placeholder="Ad Soyad" /></label>
                  <label className="form-label">Telefon<input required name="phone" type="tel" className="form-input" placeholder="05xx xxx xx xx" /></label>
                  <label className="form-label sm:col-span-2">E-posta<input required name="email" type="email" className="form-input" placeholder="isletme@ornek.com" /></label>
                  <label className="form-label">Şehir<input required name="city" className="form-input" placeholder="İstanbul" /></label>
                  <label className="form-label">İlçe<input required name="district" className="form-input" placeholder="Kadıköy" /></label>
                  <label className="sm:col-span-2 mt-2 flex items-start gap-3 text-xs leading-5 text-[var(--muted)]"><input required type="checkbox" className="mt-1 accent-[var(--forest)]" /> Başvuru ve demo kurulumu hakkında benimle iletişime geçilmesini kabul ediyorum.</label>
                  {error && <div role="alert" className="rounded-2xl border border-[#e65d4f]/25 bg-[#e65d4f]/8 px-4 py-3 text-sm font-semibold text-[#b23b2f] sm:col-span-2">{error}</div>}
                  <button disabled={sending} className="brand-button mt-2 justify-center px-6 py-4 disabled:opacity-60 sm:col-span-2">{sending ? "Gönderiliyor..." : "Başvuruyu tamamla"} <ArrowRight size={18} aria-hidden="true" /></button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
