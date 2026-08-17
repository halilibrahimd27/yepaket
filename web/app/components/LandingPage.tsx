"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  ChevronDown,
  Clock3,
  Heart,
  Leaf,
  MapPin,
  Navigation,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Store,
  TrendingDown,
  UsersRound,
  X,
} from "lucide-react";
import { SiAppstore, SiGoogleplay } from "react-icons/si";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  formatDistance,
  formatMoney,
  formatPickupWindow,
  type Bag,
  type CommunityImpact,
} from "@/lib/api";
import { faqItems } from "../data";
import { PublicFooter } from "./PublicFooter";
import { PublicHeader } from "./PublicHeader";

gsap.registerPlugin(ScrollTrigger);

const categories = ["Tümü", "Fırın", "Market", "Kafe", "Restoran"];

const rescueSteps = [
  {
    icon: Search,
    number: "01",
    title: "Yakınındaki paketi keşfet.",
    text: "Haritada sana en yakın fırın, kafe ve marketleri gör. Teslim saatine, mesafeye ve kategoriye göre seç.",
    label: "CANLI KEŞİF",
  },
  {
    icon: ShieldCheck,
    number: "02",
    title: "Ayır, güvenle öde.",
    text: "Sürpriz paketini uygulamada saniyeler içinde rezerve et. Paket tükenmeden senin için ayrılsın.",
    label: "GÜVENLİ REZERVASYON",
  },
  {
    icon: PackageCheck,
    number: "03",
    title: "Zamanında git, göster ve al.",
    text: "Teslim aralığında işletmeye uğra, uygulamadaki teslim ekranını kaydır ve iyi yemeği kurtar.",
    label: "KOLAY TESLİM",
  },
];

function StoreLinks({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`store-links ${compact ? "store-links-compact" : ""}`} aria-label="Uygulama mağazaları">
      <a href="#uygulama" className="store-badge" aria-label="App Store uygulama bilgileri">
        <SiAppstore aria-hidden="true" />
        <span><small>App Store’dan</small>İndir</span>
      </a>
      <a href="#uygulama" className="store-badge" aria-label="Google Play uygulama bilgileri">
        <SiGoogleplay aria-hidden="true" />
        <span><small>Google Play’den</small>İndir</span>
      </a>
    </div>
  );
}

/** Sözleşmedeki küçük harfli kategori değerini arayüz etiketine çevirir. */
const CATEGORY_LABELS: Record<string, string> = {
  bakery: "Fırın",
  market: "Market",
  cafe: "Kafe",
  restaurant: "Restoran",
};

export function LandingPage({
  bags,
  impact,
  apiUnavailable,
}: {
  bags: Bag[];
  impact: CommunityImpact | null;
  apiUnavailable: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState("Tümü");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedBag, setSelectedBag] = useState<Bag | null>(null);
  const [openFaq, setOpenFaq] = useState(0);
  const [notice, setNotice] = useState("");
  const [activeStep, setActiveStep] = useState(0);

  const filteredBags = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

    return bags.filter((bag) => {
      const matchesCategory =
        category === "Tümü" || CATEGORY_LABELS[bag.category] === category;

      if (!matchesCategory) return false;
      if (!normalizedQuery) return true;

      return (
        bag.title.toLocaleLowerCase("tr-TR").includes(normalizedQuery) ||
        bag.store.name.toLocaleLowerCase("tr-TR").includes(normalizedQuery)
      );
    });
  }, [bags, category, query]);

  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      gsap.from("[data-hero-copy] > *", {
        y: 28,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out",
      });
      gsap.from("[data-hero-visual]", {
        y: 35,
        rotateY: 8,
        rotateX: -3,
        opacity: 0,
        duration: 1.15,
        delay: 0.15,
        ease: "power3.out",
      });
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
        gsap.from(element, {
          y: 34,
          opacity: 0,
          duration: 0.75,
          ease: "power2.out",
          scrollTrigger: { trigger: element, start: "top 86%", once: true },
        });
      });
      gsap.to("[data-float]", {
        y: -14,
        duration: 2.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.utils.toArray<HTMLElement>("[data-rescue-step]").forEach((element, index) => {
        ScrollTrigger.create({
          trigger: element,
          start: "top 56%",
          end: "bottom 44%",
          onEnter: () => setActiveStep(index),
          onEnterBack: () => setActiveStep(index),
        });
      });

      media.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
        gsap.to("[data-parallax='slow']", {
          yPercent: -28,
          ease: "none",
          scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: 1.1 },
        });
        gsap.to("[data-parallax='fast']", {
          yPercent: 34,
          ease: "none",
          scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: 0.8 },
        });
        gsap.to("[data-hero-visual]", {
          yPercent: 18,
          rotateY: -6,
          rotateX: 4,
          scale: 0.92,
          ease: "none",
          scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: 1 },
        });
        gsap.to("[data-hero-image]", {
          scale: 1.14,
          yPercent: 6,
          ease: "none",
          scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: 1 },
        });
        gsap.to("[data-marquee-track]", {
          xPercent: -16,
          ease: "none",
          scrollTrigger: { trigger: "[data-marquee]", start: "top bottom", end: "bottom top", scrub: 1 },
        });
        gsap.to("[data-impact-photo]", {
          yPercent: 14,
          scale: 1.08,
          ease: "none",
          scrollTrigger: { trigger: "#etki", start: "top bottom", end: "bottom top", scrub: 1 },
        });
      });
    }, root);
    return () => {
      media.revert();
      context.revert();
    };
  }, []);

  function toggleFavorite(id: string) {
    setFavorites((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  }

  function reserveBag() {
    if (!selectedBag) return;
    setNotice(`${selectedBag.title} mobil uygulamada rezerve edilmeye hazır.`);
    setSelectedBag(null);
    window.setTimeout(() => setNotice(""), 3200);
  }

  return (
    <div ref={root} className="overflow-x-clip bg-[var(--cream)] text-[var(--ink)]">
      <PublicHeader />

      <main>
        <section data-hero className="hero-section relative min-h-[880px] overflow-hidden px-5 pb-24 pt-32 lg:px-8 lg:pb-32 lg:pt-40">
          <div data-parallax="slow" className="hero-orb left-[-110px] top-24 h-64 w-64 bg-[var(--lime)]/30" />
          <div data-parallax="fast" className="hero-orb bottom-20 right-[-80px] h-80 w-80 bg-[#7cc7a3]/25" />
          <div data-parallax="slow" className="hero-grid-sphere right-[38%] top-32 hidden lg:block" aria-hidden="true" />
          <div className="mx-auto grid max-w-[1240px] items-center gap-14 lg:grid-cols-[1.02fr_.98fr]">
            <div data-hero-copy className="relative z-10">
              <div className="eyebrow"><Sparkles size={15} /> Her paket yeni bir şans</div>
              {/* leading-[.88] Türkçe büyük harf aksanlarını (İ, Ğ, Ö) üstten kırpıyordu;
                  .95 hem sıkı hem güvenli. */}
              <h1 className="mt-7 max-w-[720px] text-[clamp(3.7rem,7.2vw,7.2rem)] font-black leading-[.95] tracking-[-.075em] text-[var(--forest)]">
                İyi yemek <span className="text-stroke">çöpe</span> gitmesin.
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
                Mahallendeki kafe, fırın ve marketlerin gün sonu sürpriz paketlerini üçte bir fiyatına kurtar.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="#paketler" className="brand-button justify-center px-7 py-4 text-base">
                  Yakındaki paketleri gör <ArrowRight size={18} />
                </a>
                <a href="#nasil-calisir" className="soft-button justify-center px-7 py-4 text-base">
                  Nasıl çalışır?
                </a>
              </div>
              <div className="mt-6"><StoreLinks compact /></div>
              <div className="mt-11 grid max-w-lg grid-cols-3 gap-3">
                {[
                  ["24K+", "kurtarılan paket"],
                  ["320+", "yerel işletme"],
                  ["4.8/5", "topluluk puanı"],
                ].map(([value, label]) => (
                  <div key={label} className="border-l border-[var(--forest)]/15 pl-4 first:border-0 first:pl-0">
                    <strong className="block text-xl font-black text-[var(--forest)] sm:text-2xl">{value}</strong>
                    <span className="mt-1 block text-[11px] leading-4 text-[var(--muted)] sm:text-xs">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div data-hero-visual className="hero-stage relative mx-auto w-full max-w-[590px] lg:ml-auto">
              <div className="relative overflow-hidden rounded-[42px] bg-[var(--forest)] p-3 shadow-[0_38px_90px_rgba(6,40,31,.22)]">
                <div className="overflow-hidden rounded-[33px]">
                  <img data-hero-image src="/images/hero-produce.jpg" alt="Renkli ve taze pazar sebzeleri" className="h-[600px] w-full object-cover sm:h-[650px]" />
                </div>
                <div className="absolute inset-x-3 bottom-3 rounded-[31px] bg-gradient-to-t from-[#06281f] via-[#06281f]/85 to-transparent px-6 pb-7 pt-32 text-white sm:px-8">
                  <div className="flex items-end justify-between gap-5">
                    <div>
                      <span className="rounded-full bg-[var(--lime)] px-3 py-1.5 text-xs font-black text-[var(--forest)]">BUGÜN 20:00</span>
                      <h2 className="mt-4 text-3xl font-black tracking-[-.04em] sm:text-4xl">Günün sürprizi<br />seni bekliyor.</h2>
                    </div>
                    <div className="rounded-3xl bg-white p-4 text-right text-[var(--forest)] shadow-xl">
                      <span className="text-xs font-bold text-[var(--muted)] line-through">420 ₺</span>
                      <strong className="block text-3xl font-black">139 ₺</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div data-float className="absolute -left-4 top-20 rounded-3xl bg-white p-4 shadow-2xl sm:-left-12">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--lime-soft)] text-[var(--forest)]"><Leaf size={20} /></div>
                  <div><strong className="block text-sm">2,7 kg CO₂e</strong><span className="text-xs text-[var(--muted)]">bu paketle önlendi</span></div>
                </div>
              </div>
              <div className="absolute -right-4 top-7 grid h-20 w-20 rotate-6 place-items-center rounded-[26px] bg-[var(--lime)] text-[var(--forest)] shadow-xl sm:-right-8">
                <ShoppingBag size={31} strokeWidth={2.4} />
              </div>
            </div>
          </div>
        </section>

        <section data-marquee className="marquee-band" aria-label="YePaket faydaları">
          <div data-marquee-track className="marquee-track">
            {[0, 1, 2].map((group) => (
              <div key={group} className="marquee-group" aria-hidden={group > 0}>
                <span>KURTAR <Leaf /></span>
                <span>KAZAN <BadgeCheck /></span>
                <span>PAYLAŞ <UsersRound /></span>
                <span>ATIK AZALT <TrendingDown /></span>
              </div>
            ))}
          </div>
        </section>

        <section id="paketler" className="section-curve bg-white px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-[1240px]">
            <div data-reveal className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <div className="eyebrow"><MapPin size={15} /> İstanbul · Kadıköy</div>
                <h2 className="section-title mt-6">Yakınında bugün<br />neler kurtarılıyor?</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-[var(--cream)] p-2">
                <Search size={18} className="ml-3 text-[var(--muted)]" />
                <input
                  aria-label="Paket veya işletme ara"
                  placeholder="Paket veya işletme ara"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full bg-transparent py-2 text-sm outline-none sm:w-56"
                />
              </div>
            </div>
            <div data-reveal className="no-scrollbar mt-10 flex gap-2 overflow-x-auto pb-2">
              {categories.map((item) => (
                <button key={item} onClick={() => setCategory(item)} className={`category-chip ${category === item ? "category-chip-active" : ""}`}>
                  {item}
                </button>
              ))}
            </div>
            {filteredBags.length === 0 && (
              <div
                data-reveal
                className="mt-8 rounded-[28px] border border-dashed border-[var(--forest)]/20 bg-[var(--cream)] px-6 py-14 text-center"
              >
                <p className="text-lg font-black text-[var(--forest)]">
                  {apiUnavailable
                    ? "Paketler şu an yüklenemedi."
                    : query || category !== "Tümü"
                      ? "Bu filtreye uygun paket bulunamadı."
                      : "Şu anda yayında paket yok."}
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
                  {apiUnavailable
                    ? "Bağlantı sorunu olabilir; birazdan tekrar deneyin."
                    : "Yeni paketler gün içinde eklenir. Uygulamadan bildirim açarsan ilk sen haberdar olursun."}
                </p>
              </div>
            )}

            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {filteredBags.map((bag) => (
                <article key={bag.id} data-reveal className="group overflow-hidden rounded-[28px] border border-black/5 bg-[var(--cream)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_55px_rgba(6,40,31,.12)]">
                  <div className="relative h-56 overflow-hidden">
                    <img src={bag.image_urls[0] ?? "/images/bag-bakery.jpg"} alt={`${bag.store.name} sürpriz paketi`} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    <button onClick={() => toggleFavorite(bag.id)} aria-label="Favoriye ekle" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[var(--forest)] shadow-sm backdrop-blur">
                      <Heart size={18} fill={favorites.includes(bag.id) ? "currentColor" : "none"} />
                    </button>
                    <span className="absolute bottom-4 left-4 rounded-full bg-[var(--lime)] px-3 py-1.5 text-[11px] font-black text-[var(--forest)]">SON {bag.available_quantity} PAKET</span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold uppercase tracking-[.12em] text-[var(--muted)]">{bag.store.name}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold"><Star size={13} fill="#f6b91c" color="#f6b91c" /> {bag.rating.overall.toFixed(1)}</span>
                    </div>
                    <h3 className="mt-2 text-xl font-black tracking-[-.03em] text-[var(--forest)]">{bag.title}</h3>
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
                      <span className="inline-flex items-center gap-1.5"><Clock3 size={14} />{formatPickupWindow(bag.pickup_window)}</span>
                      <span className="inline-flex items-center gap-1.5"><Navigation size={14} />{formatDistance(bag.distance_meters) ?? bag.store.address.split(",").pop()?.trim()}</span>
                    </div>
                    <div className="mt-5 flex items-end justify-between border-t border-black/8 pt-5">
                      <div><span className="text-xs text-[var(--muted)] line-through">{formatMoney(bag.original_value)}</span><strong className="ml-2 text-2xl font-black text-[var(--forest)]">{formatMoney(bag.sale_price)}</strong></div>
                      <button onClick={() => setSelectedBag(bag)} className="grid h-11 w-11 place-items-center rounded-full bg-[var(--forest)] text-white transition group-hover:bg-[var(--lime)] group-hover:text-[var(--forest)]" aria-label={`${bag.title} detayını aç`}><ArrowRight size={18} /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div data-reveal className="mt-10 text-center">
              <a href="#uygulama" className="soft-button px-7 py-4">Haritayı uygulamada aç <MapPin size={17} aria-hidden="true" /></a>
            </div>
          </div>
        </section>

        <section id="nasil-calisir" className="rescue-story px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-[.95fr_1.05fr] lg:gap-24">
            <div className="rescue-sticky">
              <div data-reveal>
                <div className="eyebrow"><Smartphone size={15} /> Üç adımda kurtar</div>
                <h2 className="section-title mt-6">Kaydır.<br />Paketi kurtar.</h2>
                <p className="mt-5 max-w-lg text-lg leading-8 text-[var(--muted)]">Her adım uygulamada karşına çıktığı haliyle sade, hızlı ve güvenli.</p>
              </div>

              <div data-reveal className="experience-stage mt-10" aria-live="polite">
                <div className="experience-glow" aria-hidden="true" />
                <div className="experience-phone">
                  <div className="experience-phone-bar"><span>09:41</span><span className="experience-island" /><span>5G</span></div>
                  <div key={activeStep} className="experience-screen">
                    <div className="flex items-center justify-between">
                      <div><span className="text-[10px] font-black tracking-[.13em] text-white/45">{rescueSteps[activeStep].label}</span><strong className="mt-1 block text-xl">{rescueSteps[activeStep].title}</strong></div>
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-[var(--lime)]">
                        {activeStep === 0 ? <MapPin size={19} /> : activeStep === 1 ? <ShieldCheck size={19} /> : <PackageCheck size={19} />}
                      </div>
                    </div>

                    {activeStep === 0 && (
                      <div className="mini-map mt-6">
                        <span className="mini-road mini-road-one" /><span className="mini-road mini-road-two" />
                        <span className="mini-zone mini-zone-one" /><span className="mini-zone mini-zone-two" />
                        <div className="map-price-pin left-[18%] top-[28%]">89 ₺</div>
                        <div className="map-price-pin right-[12%] top-[16%]">139 ₺</div>
                        <div className="map-price-pin bottom-[17%] left-[44%]">75 ₺</div>
                        <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white p-3 text-[var(--forest)] shadow-xl">
                          <span className="text-[9px] font-black tracking-[.12em] text-[var(--muted)]">240 M UZAĞINDA</span>
                          <strong className="mt-1 block text-sm">Günün Fırın Paketi</strong>
                        </div>
                      </div>
                    )}

                    {activeStep === 1 && (
                      <div className="mt-6 space-y-3">
                        <div className="flex gap-3 rounded-3xl bg-white p-3 text-[var(--forest)]">
                          <img src="/images/bag-bakery.jpg" alt="Fırın sürpriz paketi" className="h-20 w-20 rounded-2xl object-cover" />
                          <div className="py-1"><span className="text-[10px] font-bold text-[var(--muted)]">KOMŞU FIRIN</span><strong className="mt-1 block text-sm">Günün Fırın Paketi</strong><strong className="mt-2 block text-xl">139 ₺</strong></div>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/8 p-4">
                          <span className="text-xs text-white/55">Ödeme yöntemi</span>
                          <div className="mt-3 flex items-center justify-between"><strong>•••• 2048</strong><BadgeCheck className="text-[var(--lime)]" size={20} /></div>
                        </div>
                        <div className="rounded-2xl bg-[var(--lime)] py-3 text-center text-sm font-black text-[var(--forest)]">Paketi ayır</div>
                      </div>
                    )}

                    {activeStep === 2 && (
                      <div className="mt-6 rounded-[28px] bg-white p-5 text-center text-[var(--forest)]">
                        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[26px] bg-[var(--lime-soft)]"><PackageCheck size={36} /></div>
                        <span className="mt-5 block text-[10px] font-black tracking-[.14em] text-[var(--lime-dark)]">TESLİME HAZIR</span>
                        <strong className="mt-2 block text-2xl">20:00–20:30</strong>
                        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Komşu Fırın’a vardığında teslim ekranını göster.</p>
                        <div className="mt-5 rounded-full bg-[var(--forest)] px-4 py-3 text-xs font-black text-white">Teslim için kaydır</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="experience-counter"><strong>0{activeStep + 1}</strong><span>/ 03</span></div>
              </div>
            </div>

            <div className="rescue-steps">
              {rescueSteps.map(({ icon: Icon, number, title, text }, index) => (
                <article key={number} data-rescue-step className={`rescue-step ${activeStep === index ? "is-active" : ""}`}>
                  <div className="rescue-step-top">
                    <div className="rescue-step-icon"><Icon size={24} /></div>
                    <span>{number}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <div className="rescue-progress"><span /></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="etki" className="px-5 pb-24 lg:px-8 lg:pb-32">
          <div data-reveal className="mx-auto grid max-w-[1240px] overflow-hidden rounded-[42px] bg-[var(--forest)] text-white lg:grid-cols-[.9fr_1.1fr]">
            <div className="relative min-h-[420px] overflow-hidden">
              <img data-impact-photo src="/images/bag-market.jpg" alt="Pazarda taze sebzeler" className="absolute -inset-y-[10%] inset-x-0 h-[120%] w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--forest)]/90 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between">
                <div><span className="text-sm font-bold text-white/65">Topluluk etkisi</span><strong className="mt-2 block text-4xl font-black">{impact ? `${impact.saved_bags.toLocaleString("tr-TR")} paket` : "—"}</strong></div>
                <Leaf className="text-[var(--lime)]" size={42} />
              </div>
            </div>
            <div className="p-8 sm:p-12 lg:p-16">
              <div className="eyebrow border-white/10 bg-white/10 text-[var(--lime)]"><TrendingDown size={15} /> Birlikte daha az atık</div>
              <h2 className="mt-7 text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl">Küçük paket,<br />büyük fark.</h2>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">Her kurtarılan paket yalnızca bütçeni değil; üretim için kullanılan suyu, enerjiyi ve emeği de korur.</p>
              <div className="mt-10 grid grid-cols-2 gap-4">
                {(impact
                  ? [
                      [`${impact.co2e_kg.toLocaleString("tr-TR")} kg`, "CO₂e önlendi"],
                      [formatMoney(impact.money_saved), "topluluk tasarrufu"],
                      [`${impact.active_stores}`, "aktif işletme"],
                      [`${impact.saved_bags.toLocaleString("tr-TR")}`, "kurtarılan paket"],
                    ]
                  : [
                      ["—", "CO₂e önlendi"],
                      ["—", "topluluk tasarrufu"],
                      ["—", "aktif işletme"],
                      ["—", "kurtarılan paket"],
                    ]
                ).map(([value, label]) => (
                  <div key={label} className="rounded-3xl bg-white/8 p-5"><strong className="text-2xl font-black text-[var(--lime)] sm:text-3xl">{value}</strong><span className="mt-1 block text-xs text-white/55">{label}</span></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="uygulama" className="bg-white px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto grid max-w-[1240px] items-center gap-14 lg:grid-cols-2">
            <div data-reveal>
              <div className="eyebrow"><BellRing size={15} /> Favorin hazır olduğunda haberin olsun</div>
              <h2 className="section-title mt-6">YePaket cebinde,<br />iyilik peşinde.</h2>
              <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">Haritada keşfet, favoriye ekle, paket yeniden satışa çıktığında bildirimi yakala. Siparişlerini ve çevresel etkini tek yerde takip et.</p>
              <div className="mt-9"><StoreLinks /></div>
              <div className="mt-8 flex flex-wrap gap-5 text-sm font-bold text-[var(--forest)]">
                <span className="inline-flex items-center gap-2"><BadgeCheck size={17} /> Ücretsiz</span>
                <span className="inline-flex items-center gap-2"><ShieldCheck size={17} /> Güvenli ödeme</span>
                <span className="inline-flex items-center gap-2"><UsersRound size={17} /> 18K+ kullanıcı</span>
              </div>
            </div>
            <div data-reveal className="relative mx-auto w-full max-w-[500px]">
              <div className="phone-shell mx-auto">
                <div className="phone-notch" />
                <div className="h-full overflow-hidden rounded-[38px] bg-[var(--cream)]">
                  <div className="bg-[var(--forest)] px-6 pb-8 pt-12 text-white">
                    <div className="flex items-center justify-between"><div><span className="text-xs text-white/55">Konumun</span><strong className="block">Kadıköy, İstanbul</strong></div><div className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><BellRing size={18} /></div></div>
                    <h3 className="mt-8 flex items-center gap-3 text-3xl font-black tracking-[-.05em]">Merhaba Eylül <Sparkles className="text-[var(--lime)]" size={24} /></h3>
                    <p className="mt-1 text-sm text-white/60">Bugün ne kurtarıyoruz?</p>
                  </div>
                  <div className="-mt-3 space-y-3 px-4">
                    {bags.slice(0, 2).map((bag) => (
                      <div key={bag.id} className="flex gap-3 rounded-3xl bg-white p-3 shadow-lg">
                        <img src={bag.image_urls[0] ?? "/images/bag-bakery.jpg"} alt="" loading="lazy" className="h-24 w-24 rounded-2xl object-cover" />
                        <div className="min-w-0 flex-1 py-1"><span className="text-[10px] font-bold uppercase text-[var(--muted)]">{bag.store.name}</span><strong className="mt-1 block truncate text-sm text-[var(--forest)]">{bag.title}</strong><span className="mt-2 block text-xs text-[var(--muted)]">{formatPickupWindow(bag.pickup_window)}</span><strong className="mt-1 block text-lg text-[var(--forest)]">{formatMoney(bag.sale_price)}</strong></div>
                      </div>
                    ))}
                  </div>
                  <div className="absolute bottom-5 left-1/2 flex w-[88%] -translate-x-1/2 items-center justify-around rounded-full bg-white px-4 py-3 text-[var(--muted)] shadow-xl"><Store size={18} /><Search size={18} className="text-[var(--forest)]" /><Heart size={18} /><UsersRound size={18} /></div>
                </div>
              </div>
              <div className="absolute -right-4 bottom-24 rounded-3xl bg-[var(--lime)] p-5 text-[var(--forest)] shadow-xl sm:-right-10"><strong className="text-2xl font-black">₺1.280</strong><span className="block text-xs font-bold">toplam tasarruf</span></div>
            </div>
          </div>
        </section>

        <section className="px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div data-reveal>
              <div className="eyebrow"><ShoppingBag size={15} /> Merak ettiklerin</div>
              <h2 className="section-title mt-6">Kısa cevaplar,<br />iyi fikirler.</h2>
              <p className="mt-5 max-w-md leading-7 text-[var(--muted)]">Daha fazlası için yardım merkezini ziyaret edebilir veya bize yazabilirsin.</p>
            </div>
            <div data-reveal className="space-y-3">
              {faqItems.map((item, index) => (
                <div key={item.question} className="overflow-hidden rounded-[24px] border border-black/5 bg-white">
                  <button className="flex w-full items-center justify-between gap-5 px-6 py-5 text-left font-extrabold text-[var(--forest)]" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}>
                    {item.question}<ChevronDown size={19} className={`shrink-0 transition ${openFaq === index ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === index && <p className="px-6 pb-6 leading-7 text-[var(--muted)]">{item.answer}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-24 lg:px-8 lg:pb-32">
          <div data-reveal className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-8 overflow-hidden rounded-[38px] bg-[var(--lime)] p-8 sm:p-12 lg:flex-row lg:items-center lg:p-16">
            <div><span className="text-sm font-black uppercase tracking-[.16em] text-[var(--forest)]/55">İşletmeler için YePaket</span><h2 className="mt-3 text-4xl font-black leading-none tracking-[-.055em] text-[var(--forest)] sm:text-5xl">Fazlanız kazanca,<br />kazancınız etkiye dönüşsün.</h2></div>
            <a href="/isletmeler" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--forest)] px-7 py-4 font-black text-white">İşletmeni ekle <ArrowRight size={18} /></a>
          </div>
        </section>
      </main>

      <PublicFooter />

      {selectedBag && (
        <div className="fixed inset-0 z-[80] grid place-items-end bg-[#06281f]/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Paket detayı">
          <div className="max-h-[92vh] w-full overflow-auto rounded-t-[34px] bg-white shadow-2xl sm:max-w-[660px] sm:rounded-[34px]">
            <div className="relative h-72"><img src={selectedBag.image_urls[0] ?? "/images/bag-bakery.jpg"} alt="" className="h-full w-full object-cover sm:rounded-t-[34px]" /><button onClick={() => setSelectedBag(null)} className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-[var(--forest)]" aria-label="Kapat"><X size={20} /></button></div>
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-5"><div><span className="text-xs font-black uppercase tracking-[.15em] text-[var(--muted)]">{selectedBag.store.name}</span><h2 className="mt-2 text-3xl font-black tracking-[-.045em] text-[var(--forest)]">{selectedBag.title}</h2></div><div className="rounded-2xl bg-[var(--lime-soft)] px-4 py-3 text-right"><span className="block text-xs text-[var(--muted)] line-through">{formatMoney(selectedBag.original_value)}</span><strong className="text-2xl font-black text-[var(--forest)]">{formatMoney(selectedBag.sale_price)}</strong></div></div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="detail-tile"><Clock3 size={19} /><span><small>Teslim zamanı</small>{formatPickupWindow(selectedBag.pickup_window)}</span></div><div className="detail-tile"><MapPin size={19} /><span><small>Adres</small>{selectedBag.store.address}</span></div></div>
              <h3 className="mt-7 font-black text-[var(--forest)]">Pakette neler olabilir?</h3><p className="mt-2 leading-7 text-[var(--muted)]">{selectedBag.description ?? "Paketin içeriği işletmenin o gün kalan ürünlerine göre değişir."}</p>
              <div className="mt-7 flex items-center justify-between rounded-2xl bg-[var(--cream)] p-4"><span className="inline-flex items-center gap-2 font-bold"><Star size={17} fill="#f6b91c" color="#f6b91c" /> {selectedBag.rating.overall.toFixed(1)} <small className="font-normal text-[var(--muted)]">({selectedBag.rating.count} değerlendirme)</small></span><span className="font-black text-[var(--forest)]">Son {selectedBag.available_quantity}</span></div>
              <button onClick={reserveBag} className="brand-button mt-7 w-full justify-center px-6 py-4 text-base">Mobil uygulamada rezerve et <ArrowRight size={18} /></button>
            </div>
          </div>
        </div>
      )}

      {notice && <div className="fixed bottom-5 left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-[var(--forest)] px-5 py-4 font-bold text-white shadow-2xl"><BadgeCheck className="shrink-0 text-[var(--lime)]" />{notice}</div>}
    </div>
  );
}
