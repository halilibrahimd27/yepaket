"use client";

import {
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Coins,
  Download,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  MoreHorizontal,
  PackagePlus,
  PackageSearch,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import gsap from "gsap";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { dashboardOrders, surpriseBags } from "../data";

type PanelTab = "Genel Bakış" | "Paketler" | "Siparişler" | "Gelir" | "Mağaza";

const menu: { label: PanelTab; shortLabel: string; icon: typeof LayoutDashboard }[] = [
  { label: "Genel Bakış", shortLabel: "Özet", icon: LayoutDashboard },
  { label: "Paketler", shortLabel: "Paketler", icon: ShoppingBag },
  { label: "Siparişler", shortLabel: "Siparişler", icon: PackageSearch },
  { label: "Gelir", shortLabel: "Gelir", icon: BarChart3 },
  { label: "Mağaza", shortLabel: "Mağaza", icon: Store },
];

export function DashboardPage() {
  const [tab, setTab] = useState<PanelTab>("Genel Bakış");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Record<string, string>>(
    Object.fromEntries(dashboardOrders.map((order) => [order.id, order.status])),
  );
  const [activeBags, setActiveBags] = useState<Record<string, boolean>>(
    Object.fromEntries(surpriseBags.slice(0, 3).map((bag) => [bag.id, true])),
  );

  useEffect(() => {
    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-panel-intro]",
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.55, stagger: 0.06, ease: "power3.out" },
      );
    }, rootRef);
    return () => context.revert();
  }, [tab]);

  const selectTab = (nextTab: PanelTab) => {
    setTab(nextTab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div ref={rootRef} className="min-h-screen bg-[var(--cream)] text-[var(--ink)]">
      <AdminHeader
        tab={tab}
        setTab={selectTab}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        setCreateOpen={setCreateOpen}
      />

      <main>
        {tab === "Genel Bakış" && (
          <Overview
            setTab={selectTab}
            setCreateOpen={setCreateOpen}
            status={status}
            setStatus={setStatus}
            activeBags={activeBags}
          />
        )}
        {tab === "Paketler" && (
          <BagsPanel
            activeBags={activeBags}
            setActiveBags={setActiveBags}
            setCreateOpen={setCreateOpen}
          />
        )}
        {tab === "Siparişler" && <OrdersPanel status={status} setStatus={setStatus} />}
        {tab === "Gelir" && <RevenuePanel />}
        {tab === "Mağaza" && <StorePanel />}
      </main>

      {createOpen && (
        <CreateBagModal
          created={created}
          setCreated={setCreated}
          close={() => {
            setCreateOpen(false);
            setCreated(false);
          }}
        />
      )}
    </div>
  );
}

function AdminHeader({
  tab,
  setTab,
  mobileMenuOpen,
  setMobileMenuOpen,
  setCreateOpen,
}: {
  tab: PanelTab;
  setTab: (tab: PanelTab) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (value: boolean) => void;
  setCreateOpen: (value: boolean) => void;
}) {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 p-3 sm:p-4">
        <div className="mx-auto flex h-16 max-w-[1560px] items-center justify-between rounded-[17px] border border-white/10 bg-[#072d24]/95 px-3 shadow-[0_20px_60px_rgba(5,31,24,.18)] backdrop-blur-xl sm:px-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="YePaket ana sayfa">
            <img
              src="/images/yep-logo.png"
              alt="YEP logo"
              className="h-10 w-10 rounded-[12px] object-cover"
            />
            <span className="hidden text-lg font-black tracking-[-.04em] text-white sm:block">
              Ye<span className="text-[var(--lime)]">Paket</span>
            </span>
            <span className="hidden rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-white/45 xl:block">
              MyStore
            </span>
          </Link>

          <nav className="hidden items-center rounded-[11px] border border-white/10 bg-black/10 p-1 lg:flex" aria-label="Panel menüsü">
            {menu.map((item, index) => (
              <button
                key={item.label}
                onClick={() => setTab(item.label)}
                className={`flex items-center gap-2 rounded-[8px] px-3.5 py-2 text-[11px] font-extrabold transition xl:px-4 ${
                  tab === item.label
                    ? "bg-white text-[var(--forest)] shadow-sm"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className={tab === item.label ? "text-[var(--lime-dark)]" : "text-white/25"}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item.shortLabel}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="mr-1 hidden items-center gap-2 border-r border-white/10 pr-3 md:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--lime)] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--lime)]" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-[.12em] text-white/55">Mağaza açık</span>
            </div>
            <button className="relative grid h-10 w-10 place-items-center rounded-[10px] border border-white/10 text-white/75 hover:bg-white/10" aria-label="Bildirimler">
              <Bell size={17} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--lime)]" />
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="hidden h-10 items-center gap-2 rounded-[10px] bg-[var(--lime)] px-4 text-xs font-black text-[var(--forest)] transition hover:bg-white sm:flex"
            >
              Yeni paket <ArrowUpRight size={15} />
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-[10px] border border-white/10 text-white lg:hidden"
              aria-label="Panel menüsünü aç"
            >
              <Menu size={19} />
            </button>
          </div>
        </div>
      </header>

      <div className={`fixed inset-0 z-[70] bg-[var(--forest)] p-5 text-white transition lg:hidden ${mobileMenuOpen ? "visible opacity-100" : "invisible opacity-0"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/yep-logo.png" alt="YEP logo" className="h-11 w-11 rounded-[13px] object-cover" />
            <strong className="text-xl">YePaket MyStore</strong>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="grid h-11 w-11 place-items-center rounded-full bg-white/10" aria-label="Menüyü kapat">
            <X size={20} />
          </button>
        </div>
        <nav className="mt-14 space-y-2">
          {menu.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => setTab(item.label)}
                className={`flex w-full items-center gap-4 rounded-[18px] border px-4 py-4 text-left ${tab === item.label ? "border-[var(--lime)] bg-[var(--lime)] text-[var(--forest)]" : "border-white/10 bg-white/5"}`}
              >
                <span className="text-[10px] font-black opacity-50">{String(index + 1).padStart(2, "0")}</span>
                <Icon size={20} />
                <strong>{item.label}</strong>
                <ChevronRight className="ml-auto" size={18} />
              </button>
            );
          })}
        </nav>
        <button onClick={() => { setCreateOpen(true); setMobileMenuOpen(false); }} className="mt-6 flex w-full items-center justify-center gap-2 rounded-[16px] bg-white py-4 font-black text-[var(--forest)]">
          <Plus size={18} /> Yeni paket oluştur
        </button>
        <div className="absolute inset-x-5 bottom-6 flex gap-2 border-t border-white/10 pt-5">
          <button className="flex flex-1 items-center gap-2 rounded-xl px-3 py-3 text-sm text-white/55"><Settings size={17} /> Ayarlar</button>
          <Link href="/" className="flex flex-1 items-center justify-end gap-2 rounded-xl px-3 py-3 text-sm text-white/55"><LogOut size={17} /> Çıkış</Link>
        </div>
      </div>
    </>
  );
}

function Overview({
  setTab,
  setCreateOpen,
  status,
  setStatus,
  activeBags,
}: {
  setTab: (tab: PanelTab) => void;
  setCreateOpen: (value: boolean) => void;
  status: Record<string, string>;
  setStatus: (value: Record<string, string>) => void;
  activeBags: Record<string, boolean>;
}) {
  const metrics = [
    { index: "01", label: "Bugünkü ciro", value: "4.268 ₺", delta: "+12,8%", icon: Coins, tone: "lime" },
    { index: "02", label: "Kurtarılan paket", value: "31", delta: "+7 paket", icon: Leaf, tone: "white" },
    { index: "03", label: "Aktif sipariş", value: "12", delta: "3 teslim yakın", icon: ShoppingBag, tone: "white" },
    { index: "04", label: "Yeni müşteri", value: "18", delta: "+9,4%", icon: UsersRound, tone: "forest" },
  ];
  const bars = [54, 68, 48, 82, 72, 94, 66];

  return (
    <>
      <section className="admin-grid-bg overflow-hidden bg-[var(--forest)] px-5 pb-20 pt-28 text-white sm:px-8 sm:pb-24 sm:pt-32">
        <div className="mx-auto grid max-w-[1480px] gap-12 xl:grid-cols-[1.08fr_.92fr] xl:items-center">
          <div data-panel-intro>
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[.18em] text-white/50">
              <span className="h-2 w-2 rounded-full bg-[var(--lime)] shadow-[0_0_0_5px_rgba(199,242,43,.1)]" />
              Moda Fırını · Canlı operasyon merkezi
            </div>
            <h1 className="admin-display mt-8 max-w-[830px] text-[clamp(4rem,8.2vw,8.8rem)] font-black">
              İyi yemek<br />
              <span className="text-[var(--lime)]">satılır.</span><br />
              İsraf edilmez.
            </h1>
            <p className="mt-7 max-w-xl text-sm font-medium leading-7 text-white/55 sm:text-base">
              Bugünün üretimini, teslim akışını ve kazancını tek ekranda yönet. Her paket yeni bir müşteri, her teslim daha az israf.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => setCreateOpen(true)} className="flex items-center gap-3 rounded-[11px] bg-[var(--lime)] px-5 py-4 text-sm font-black text-[var(--forest)] transition hover:bg-white">
                Paket oluştur <ArrowUpRight size={17} />
              </button>
              <button onClick={() => setTab("Siparişler")} className="flex items-center gap-3 rounded-[11px] border border-white/15 px-5 py-4 text-sm font-black text-white transition hover:bg-white/10">
                Canlı siparişler <ChevronRight size={17} />
              </button>
            </div>
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/10 pt-6">
              <div><strong className="block text-xl text-[var(--lime)]">%73</strong><span className="text-[10px] uppercase tracking-[.12em] text-white/35">ortalama indirim</span></div>
              <div><strong className="block text-xl">4,8/5</strong><span className="text-[10px] uppercase tracking-[.12em] text-white/35">müşteri puanı</span></div>
              <div><strong className="block text-xl">8,4 kg</strong><span className="text-[10px] uppercase tracking-[.12em] text-white/35">CO₂e önlendi</span></div>
            </div>
          </div>

          <div data-panel-intro className="relative mx-auto w-full max-w-[650px] xl:mx-0 xl:ml-auto">
            <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#edf0e8] p-3 shadow-[0_45px_100px_rgba(0,0,0,.3)] sm:p-4">
              <div className="flex items-center justify-between rounded-[18px] bg-white px-4 py-3 text-[var(--forest)]">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--lime-dark)]" /><strong className="text-xs">Bugünün operasyonu</strong></div>
                <span className="text-[10px] font-black uppercase tracking-[.12em] text-[var(--muted)]">10 Ağustos · 19:42</span>
              </div>
              <div className="relative mt-3 h-48 overflow-hidden rounded-[20px] sm:h-56">
                <img src="/images/bag-bakery.jpg" alt="Moda Fırını paket hazırlığı" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--forest)] via-transparent to-transparent" />
                <div className="absolute inset-x-4 bottom-4 flex items-end justify-between text-white">
                  <div><span className="text-[9px] font-black uppercase tracking-[.14em] text-white/60">Sıradaki teslim</span><strong className="mt-1 block text-xl">20:00–20:30</strong></div>
                  <div className="rounded-[10px] bg-[var(--lime)] px-3 py-2 text-right text-[var(--forest)]"><strong className="block text-lg">12</strong><span className="text-[8px] font-black uppercase">paket hazır</span></div>
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                {dashboardOrders.slice(0, 3).map((order, index) => (
                  <div key={order.id} className="flex items-center gap-3 rounded-[16px] bg-white p-3 text-[var(--ink)]">
                    <div className="grid h-10 w-10 place-items-center rounded-[12px] bg-[var(--lime-soft)] text-xs font-black text-[var(--forest)]">{order.customer.split(" ").map((part) => part[0]).join("")}</div>
                    <div className="min-w-0 flex-1"><strong className="block truncate text-xs">{order.customer} · {order.id}</strong><span className="text-[10px] text-[var(--muted)]">{order.bag}</span></div>
                    <div className="text-right"><strong className="block text-xs text-[var(--forest)]">{order.time}</strong><span className={`text-[9px] font-black ${index === 0 ? "text-[var(--lime-dark)]" : "text-[var(--muted)]"}`}>{status[order.id]}</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -left-4 top-24 hidden rounded-[14px] border border-white/10 bg-[#082f26] px-4 py-3 shadow-2xl sm:block xl:-left-16">
              <span className="text-[9px] uppercase tracking-[.12em] text-white/40">Anlık satış</span><strong className="mt-1 block text-lg text-[var(--lime)]">+139 ₺</strong>
            </div>
            <div className="absolute -right-3 bottom-28 hidden rounded-[14px] bg-[var(--lime)] px-4 py-3 text-[var(--forest)] shadow-2xl sm:block xl:-right-10">
              <span className="text-[9px] font-black uppercase tracking-[.12em] opacity-55">Son 1 saat</span><strong className="mt-1 block text-lg">7 paket</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--cream)] px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1480px]">
          <SectionIntro
            index="01"
            eyebrow="Bugünün özeti"
            title={<>Rakamlar net.<br /><span className="text-[var(--lime-dark)]">Etki gerçek.</span></>}
            description="Satıştan teslimata, bugünkü operasyonunun önemli sinyalleri."
          />

          <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ index, label, value, delta, icon: Icon, tone }) => (
              <article
                key={label}
                data-panel-intro
                className={`min-h-[250px] rounded-[18px] border p-5 ${
                  tone === "lime"
                    ? "border-[var(--lime)] bg-[var(--lime)] text-[var(--forest)]"
                    : tone === "forest"
                      ? "border-[var(--forest)] bg-[var(--forest)] text-white"
                      : "border-[var(--line)] bg-white text-[var(--forest)]"
                }`}
              >
                <div className="flex items-start justify-between"><span className="text-[10px] font-black tracking-[.16em] opacity-45">{index}</span><Icon size={21} /></div>
                <div className="mt-16"><span className="text-[11px] font-extrabold opacity-55">{label}</span><strong className="mt-1 block text-4xl font-black tracking-[-.055em]">{value}</strong></div>
                <div className="mt-5 flex items-center gap-2 border-t border-current/10 pt-4 text-[10px] font-black"><TrendingUp size={14} />{delta}<span className="ml-auto opacity-45">Düne göre</span></div>
              </article>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
            <article data-panel-intro className="rounded-[22px] border border-[var(--line)] bg-white p-5 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div><span className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--lime-dark)]">7 günlük görünüm</span><h2 className="mt-2 text-2xl font-black tracking-[-.04em] text-[var(--forest)]">Paket kurtarma ritmi</h2></div>
                <button className="flex items-center gap-2 rounded-[10px] border border-[var(--line)] px-3 py-2 text-[10px] font-black text-[var(--muted)]"><CalendarDays size={14} /> 4–10 Ağustos</button>
              </div>
              <div className="mt-10 flex h-64 items-end gap-2 sm:gap-4">
                {bars.map((height, index) => (
                  <div key={index} className="group flex flex-1 flex-col items-center gap-3">
                    <span className="text-[9px] font-black text-[var(--muted)] opacity-0 transition group-hover:opacity-100">{Math.round(height * 0.42)}</span>
                    <div className="relative flex h-48 w-full items-end overflow-hidden rounded-[8px] bg-[var(--cream)]">
                      <div className={`w-full rounded-[8px] transition-all group-hover:bg-[var(--lime-dark)] ${index === 5 ? "bg-[var(--lime)]" : "bg-[var(--forest)]"}`} style={{ height: `${height}%` }} />
                    </div>
                    <span className="text-[9px] font-black uppercase text-[var(--muted)]">{["Sal", "Çar", "Per", "Cum", "Cmt", "Paz", "Pzt"][index]}</span>
                  </div>
                ))}
              </div>
            </article>

            <article data-panel-intro className="rounded-[22px] bg-[var(--forest)] p-5 text-white sm:p-7">
              <div className="flex items-start justify-between"><div><span className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--lime)]">Şu an yayında</span><h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Canlı paketler</h2></div><span className="rounded-[8px] bg-white/10 px-2.5 py-1.5 text-[9px] font-black">3 AKTİF</span></div>
              <div className="mt-7 space-y-2">
                {surpriseBags.slice(0, 3).map((bag) => (
                  <button key={bag.id} onClick={() => setTab("Paketler")} className="flex w-full items-center gap-3 rounded-[14px] border border-white/8 bg-white/5 p-3 text-left transition hover:bg-white/10">
                    <img src={bag.image} alt="" className="h-12 w-12 rounded-[11px] object-cover" />
                    <div className="min-w-0 flex-1"><strong className="block truncate text-xs">{bag.title}</strong><span className="text-[9px] text-white/40">{bag.pickup} · {bag.price} ₺</span></div>
                    <div className="text-right"><strong className="block text-base text-[var(--lime)]">{activeBags[bag.id] ? bag.left : 0}</strong><span className="text-[8px] uppercase text-white/35">kaldı</span></div>
                  </button>
                ))}
              </div>
              <button onClick={() => setCreateOpen(true)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--lime)] py-3.5 text-xs font-black text-[var(--forest)] transition hover:bg-white"><Plus size={15} /> Hızlı paket ekle</button>
            </article>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--line)] bg-white px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1480px]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <SectionIntro index="02" eyebrow="Canlı akış" title={<>Sipariş geldi.<br />Teslime hazır.</>} description="Teslim saatine yaklaşan rezervasyonları önceliklendir." />
            <button onClick={() => setTab("Siparişler")} className="flex w-fit items-center gap-3 rounded-[11px] bg-[var(--forest)] px-5 py-4 text-xs font-black text-white">Tüm siparişler <ArrowUpRight size={16} /></button>
          </div>
          <div data-panel-intro className="mt-10 rounded-[20px] border border-[var(--line)] bg-[var(--cream)] p-3 sm:p-5">
            <OrdersTable status={status} setStatus={setStatus} limit={4} />
          </div>
        </div>
      </section>
    </>
  );
}

function BagsPanel({
  activeBags,
  setActiveBags,
  setCreateOpen,
}: {
  activeBags: Record<string, boolean>;
  setActiveBags: (value: Record<string, boolean>) => void;
  setCreateOpen: (value: boolean) => void;
}) {
  return (
    <PanelPage>
      <PanelPageHeader
        index="02"
        eyebrow="Paket stüdyosu"
        title={<>Üretimi planla.<br /><span className="text-[var(--lime-dark)]">Stoğu değerlendir.</span></>}
        description="Sürpriz paketlerini bir ürün koleksiyonu gibi planla, yayınla ve ölç."
        action={<button onClick={() => setCreateOpen(true)} className="admin-primary-button"><Plus size={16} /> Yeni paket</button>}
      />

      <div className="mt-12 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {surpriseBags.slice(0, 3).map((bag, index) => (
          <article key={bag.id} data-panel-intro className="group overflow-hidden rounded-[20px] border border-[var(--line)] bg-white">
            <div className="relative h-56 overflow-hidden">
              <img src={bag.image} alt={`${bag.title} görseli`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--forest)]/80 via-transparent to-transparent" />
              <span className="absolute left-4 top-4 rounded-[9px] bg-white/90 px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] text-[var(--forest)]">{String(index + 1).padStart(2, "0")} · {bag.category}</span>
              <div className="absolute inset-x-4 bottom-4 flex items-end justify-between text-white"><div><span className="text-[9px] uppercase tracking-[.12em] text-white/55">Teslim</span><strong className="block text-lg">{bag.pickup}</strong></div><strong className="text-2xl text-[var(--lime)]">{bag.price} ₺</strong></div>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="text-xl font-black tracking-[-.035em] text-[var(--forest)]">{bag.title}</h2><p className="mt-1 text-xs text-[var(--muted)]">Bugünkü üretimden sürpriz seçki</p></div>
                <button onClick={() => setActiveBags({ ...activeBags, [bag.id]: !activeBags[bag.id] })} className={`relative h-7 w-12 shrink-0 rounded-full transition ${activeBags[bag.id] ? "bg-[var(--lime-dark)]" : "bg-black/15"}`} aria-label={`${bag.title} paketini aç veya kapat`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${activeBags[bag.id] ? "left-6" : "left-1"}`} /></button>
              </div>
              <div className="mt-6 grid grid-cols-3 border-y border-[var(--line)] py-4 text-center">
                <div><strong className="block text-xl text-[var(--forest)]">{activeBags[bag.id] ? bag.left : 0}</strong><span className="text-[9px] uppercase text-[var(--muted)]">Stok</span></div>
                <div className="border-x border-[var(--line)]"><strong className="block text-xl text-[var(--forest)]">{bag.rating}</strong><span className="text-[9px] uppercase text-[var(--muted)]">Puan</span></div>
                <div><strong className="block text-xl text-[var(--forest)]">%{Math.round((1 - bag.price / bag.originalPrice) * 100)}</strong><span className="text-[9px] uppercase text-[var(--muted)]">İndirim</span></div>
              </div>
              <div className="mt-4 flex items-center justify-between"><span className={`inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.1em] ${activeBags[bag.id] ? "text-[var(--lime-dark)]" : "text-[var(--muted)]"}`}><span className={`h-2 w-2 rounded-full ${activeBags[bag.id] ? "bg-[var(--lime-dark)]" : "bg-black/20"}`} />{activeBags[bag.id] ? "Yayında" : "Durduruldu"}</span><button className="flex items-center gap-1 text-xs font-black text-[var(--forest)]">Düzenle <ArrowUpRight size={14} /></button></div>
            </div>
          </article>
        ))}
      </div>

      <button onClick={() => setCreateOpen(true)} data-panel-intro className="mt-4 flex min-h-36 w-full items-center justify-center gap-4 rounded-[20px] border border-dashed border-[var(--forest)]/25 bg-[var(--lime-soft)]/40 text-[var(--forest)] transition hover:bg-[var(--lime-soft)]">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--forest)] text-white"><PackagePlus size={19} /></span>
        <span className="text-left"><strong className="block">Yeni bir paket fikrin mi var?</strong><span className="text-xs text-[var(--muted)]">Teslim zamanı, stok ve fiyatı birkaç adımda belirle.</span></span>
      </button>
    </PanelPage>
  );
}

function OrdersPanel({ status, setStatus }: { status: Record<string, string>; setStatus: (value: Record<string, string>) => void }) {
  return (
    <PanelPage>
      <PanelPageHeader
        index="03"
        eyebrow="Teslim masası"
        title={<>Her siparişin<br /><span className="text-[var(--lime-dark)]">bir sırası var.</span></>}
        description="Bekleyen, hazırlanan ve teslim edilen paketleri canlı akıştan yönet."
        action={<button className="admin-secondary-button"><Download size={15} /> Rapor indir</button>}
      />

      <div className="mt-12 grid gap-3 sm:grid-cols-3">
        {[
          ["Bekleyen", "04", "20:00 öncesi"],
          ["Hazırlanıyor", "08", "Ort. 6 dakika"],
          ["Teslim edildi", "19", "Bugün"],
        ].map(([label, value, note], index) => (
          <article key={label} data-panel-intro className={`rounded-[18px] border p-5 ${index === 1 ? "border-[var(--lime)] bg-[var(--lime)]" : "border-[var(--line)] bg-white"}`}>
            <span className="text-[9px] font-black uppercase tracking-[.14em] text-[var(--muted)]">0{index + 1} · {label}</span>
            <div className="mt-8 flex items-end justify-between"><strong className="text-5xl font-black tracking-[-.06em] text-[var(--forest)]">{value}</strong><span className="pb-1 text-[10px] font-bold text-[var(--muted)]">{note}</span></div>
          </article>
        ))}
      </div>

      <section data-panel-intro className="mt-4 rounded-[20px] border border-[var(--line)] bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto">
            {['Tümü 31', 'Bekleyen 4', 'Hazırlanan 8', 'Tamamlanan 19'].map((filter, index) => <button key={filter} className={`shrink-0 rounded-[9px] px-3 py-2 text-[10px] font-black ${index === 0 ? "bg-[var(--forest)] text-white" : "bg-[var(--cream)] text-[var(--muted)]"}`}>{filter}</button>)}
          </div>
          <label className="flex items-center gap-2 rounded-[10px] border border-[var(--line)] px-3 py-2 text-[var(--muted)]"><Search size={14} /><input aria-label="Siparişlerde ara" placeholder="Sipariş veya müşteri ara" className="w-full bg-transparent text-xs outline-none sm:w-52" /></label>
        </div>
        <OrdersTable status={status} setStatus={setStatus} />
      </section>
    </PanelPage>
  );
}

function OrdersTable({ status, setStatus, limit }: { status: Record<string, string>; setStatus: (value: Record<string, string>) => void; limit?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left">
        <thead><tr className="border-b border-[var(--line)] text-[9px] font-black uppercase tracking-[.12em] text-[var(--muted)]"><th className="px-3 py-4">Sipariş</th><th className="px-3 py-4">Müşteri</th><th className="px-3 py-4">Paket</th><th className="px-3 py-4">Teslim</th><th className="px-3 py-4">Tutar</th><th className="px-3 py-4">Durum</th><th className="px-3 py-4" /></tr></thead>
        <tbody>
          {dashboardOrders.slice(0, limit).map((order) => (
            <tr key={order.id} className="border-b border-[var(--line)] text-xs last:border-0 hover:bg-white/65">
              <td className="px-3 py-4 font-black text-[var(--forest)]">{order.id}</td>
              <td className="px-3 py-4"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--lime-soft)] text-[9px] font-black text-[var(--forest)]">{order.customer.split(" ").map((part) => part[0]).join("")}</span><strong>{order.customer}</strong></div></td>
              <td className="px-3 py-4 text-[var(--muted)]">{order.bag}</td>
              <td className="px-3 py-4"><span className="inline-flex items-center gap-1.5 font-bold text-[var(--forest)]"><Clock3 size={13} />{order.time}</span></td>
              <td className="px-3 py-4 font-black">{order.amount} ₺</td>
              <td className="px-3 py-4"><span className={`rounded-[8px] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[.06em] ${status[order.id] === "Teslim edildi" ? "bg-[#e7f8ef] text-[#13834f]" : status[order.id] === "Hazırlanıyor" ? "bg-[#fff7d9] text-[#8a6a00]" : "bg-[var(--cream)] text-[var(--muted)]"}`}>{status[order.id]}</span></td>
              <td className="px-3 py-4 text-right">{status[order.id] !== "Teslim edildi" ? <button onClick={() => setStatus({ ...status, [order.id]: "Teslim edildi" })} className="rounded-[8px] bg-[var(--forest)] px-3 py-2 text-[9px] font-black text-white hover:bg-[var(--lime-dark)]">Teslim et</button> : <button className="text-[var(--muted)]" aria-label={`${order.id} seçenekleri`}><MoreHorizontal size={17} /></button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevenuePanel() {
  const bars = [36, 54, 48, 72, 63, 86, 78, 92, 66, 100, 82, 94];
  return (
    <PanelPage>
      <PanelPageHeader
        index="04"
        eyebrow="Gelir & hakediş"
        title={<>İsraf azalırken<br /><span className="text-[var(--lime-dark)]">kazanç büyür.</span></>}
        description="Brüt satış, hizmet bedeli, iade ve net hakedişin aynı görünümde."
        action={<button className="admin-secondary-button"><Download size={15} /> Ekstre indir</button>}
      />

      <div className="mt-12 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <article data-panel-intro className="admin-grid-bg min-h-[410px] rounded-[22px] bg-[var(--forest)] p-6 text-white sm:p-8">
          <div className="flex items-start justify-between"><div><span className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--lime)]">Ağustos net hakediş</span><strong className="mt-4 block text-[clamp(3.5rem,7vw,6.8rem)] font-black leading-none tracking-[-.075em]">38.740 ₺</strong></div><WalletCards className="text-[var(--lime)]" size={28} /></div>
          <div className="mt-16 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3"><div><span className="text-[9px] uppercase text-white/35">Sonraki ödeme</span><strong className="mt-1 block text-sm text-[var(--lime)]">1 Eylül 2026</strong></div><div><span className="text-[9px] uppercase text-white/35">Toplam sipariş</span><strong className="mt-1 block text-sm">284 paket</strong></div><div><span className="text-[9px] uppercase text-white/35">Geçen aya göre</span><strong className="mt-1 flex items-center gap-1 text-sm"><TrendingUp size={14} /> +18,4%</strong></div></div>
        </article>
        <article data-panel-intro className="rounded-[22px] border border-[var(--line)] bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between"><div><span className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--muted)]">Aylık tempo</span><h2 className="mt-2 text-2xl font-black text-[var(--forest)]">Satış ritmi</h2></div><TrendingUp className="text-[var(--lime-dark)]" /></div>
          <div className="mt-10 flex h-48 items-end gap-2">{bars.map((height, index) => <div key={index} className={`flex-1 rounded-[6px] ${index === bars.length - 3 ? "bg-[var(--lime)]" : "bg-[var(--forest)]"}`} style={{ height: `${height}%` }} />)}</div>
          <div className="mt-4 flex justify-between text-[9px] font-black uppercase text-[var(--muted)]"><span>1 Ağu</span><span>Bugün</span></div>
        </article>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["01", "Brüt satış", "44.612 ₺", "+16,2%"],
          ["02", "Platform hizmeti", "−5.352 ₺", "%12"],
          ["03", "İade", "−520 ₺", "4 işlem"],
          ["04", "Net hakediş", "38.740 ₺", "+18,4%"],
        ].map(([index, label, value, note], itemIndex) => (
          <article key={label} data-panel-intro className={`rounded-[18px] border p-5 ${itemIndex === 3 ? "border-[var(--lime)] bg-[var(--lime)]" : "border-[var(--line)] bg-white"}`}><div className="flex justify-between text-[9px] font-black uppercase tracking-[.12em] text-[var(--muted)]"><span>{index}</span><span>{note}</span></div><span className="mt-12 block text-[10px] font-bold text-[var(--muted)]">{label}</span><strong className="mt-1 block text-2xl font-black text-[var(--forest)]">{value}</strong></article>
        ))}
      </div>
    </PanelPage>
  );
}

function StorePanel() {
  const [saved, setSaved] = useState(false);
  return (
    <PanelPage>
      <PanelPageHeader
        index="05"
        eyebrow="Mağaza kimliği"
        title={<>İnsanlar önce<br /><span className="text-[var(--lime-dark)]">hikâyeni görür.</span></>}
        description="Kullanıcıların uygulamada gördüğü işletme bilgilerini güncel tut."
      />

      <div className="mt-12 grid gap-4 xl:grid-cols-[.7fr_1.3fr]">
        <aside data-panel-intro className="overflow-hidden rounded-[22px] bg-[var(--forest)] text-white">
          <div className="relative h-64"><img src="/images/bag-bakery.jpg" alt="Moda Fırını vitrini" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[var(--forest)] via-transparent to-transparent" /><div className="absolute inset-x-5 bottom-5"><span className="text-[9px] font-black uppercase tracking-[.14em] text-[var(--lime)]">Uygulamadaki görünüm</span><h2 className="mt-2 text-3xl font-black tracking-[-.05em]">Moda Fırını</h2></div></div>
          <div className="p-6"><div className="flex items-center justify-between border-b border-white/10 pb-5"><div><span className="text-[9px] text-white/35">Puan</span><strong className="block text-xl text-[var(--lime)]">4,8 / 5</strong></div><div className="text-right"><span className="text-[9px] text-white/35">Kurtarılan</span><strong className="block text-xl">1.284 paket</strong></div></div><p className="mt-5 text-xs leading-6 text-white/55">Mahallenin günlük ekşi mayalı ekmek, kruvasan ve tatlı durağı.</p><div className="mt-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.1em] text-[var(--lime)]"><span className="h-2 w-2 rounded-full bg-[var(--lime)]" /> Profil yayında</div></div>
        </aside>

        <form onSubmit={(event) => { event.preventDefault(); setSaved(true); }} data-panel-intro className="grid gap-5 rounded-[22px] border border-[var(--line)] bg-white p-5 sm:grid-cols-2 sm:p-8">
          <div className="sm:col-span-2"><span className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--lime-dark)]">Temel bilgiler</span><h2 className="mt-2 text-2xl font-black tracking-[-.04em] text-[var(--forest)]">Mağaza profilini düzenle</h2></div>
          <label className="form-label sm:col-span-2">İşletme adı<input className="form-input" defaultValue="Moda Fırını" /></label>
          <label className="form-label">Kategori<select className="form-input"><option>Fırın / Pastane</option><option>Kafe</option><option>Market</option></select></label>
          <label className="form-label">Telefon<input className="form-input" defaultValue="0216 555 42 42" /></label>
          <label className="form-label sm:col-span-2">Adres<input className="form-input" defaultValue="Caferağa Mah. Moda Cad. No:44, Kadıköy / İstanbul" /></label>
          <label className="form-label">Açılış<input type="time" className="form-input" defaultValue="07:30" /></label>
          <label className="form-label">Kapanış<input type="time" className="form-input" defaultValue="21:30" /></label>
          <label className="form-label sm:col-span-2">Mağaza açıklaması<textarea className="form-input min-h-28 resize-none" defaultValue="Mahallenin günlük ekşi mayalı ekmek, kruvasan ve tatlı durağı." /></label>
          <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-5 sm:col-span-2">{saved && <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#13834f]"><Check size={15} /> Kaydedildi</span>}<button className="admin-primary-button">Değişiklikleri kaydet <ArrowUpRight size={15} /></button></div>
        </form>
      </div>
    </PanelPage>
  );
}

function PanelPage({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[var(--cream)] px-5 pb-24 pt-32 sm:px-8 sm:pt-36"><div className="mx-auto max-w-[1480px]">{children}</div></div>;
}

function PanelPageHeader({ index, eyebrow, title, description, action }: { index: string; eyebrow: string; title: ReactNode; description: string; action?: ReactNode }) {
  return (
    <div data-panel-intro className="flex flex-col gap-8 border-b border-[var(--line)] pb-10 lg:flex-row lg:items-end lg:justify-between">
      <SectionIntro index={index} eyebrow={eyebrow} title={title} description={description} />
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function SectionIntro({ index, eyebrow, title, description }: { index: string; eyebrow: string; title: ReactNode; description: string }) {
  return (
    <div className="max-w-[920px]">
      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[.16em] text-[var(--muted)]"><span className="text-[var(--lime-dark)]">{index}</span><span className="h-px w-8 bg-[var(--line)]" />{eyebrow}</div>
      <h2 className="mt-5 text-[clamp(2.8rem,6vw,6rem)] font-black leading-[.91] tracking-[-.07em] text-[var(--forest)]">{title}</h2>
      <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--muted)]">{description}</p>
    </div>
  );
}

function CreateBagModal({ created, setCreated, close }: { created: boolean; setCreated: (value: boolean) => void; close: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-end bg-[#06281f]/75 backdrop-blur-sm sm:place-items-center sm:p-5">
      <div className="max-h-[94vh] w-full overflow-auto rounded-t-[28px] bg-[var(--cream)] shadow-2xl sm:max-w-[780px] sm:rounded-[24px]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[var(--cream)]/95 px-5 py-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--lime)] text-[var(--forest)]"><Sparkles size={17} /></span><div><span className="text-[9px] font-black uppercase tracking-[.14em] text-[var(--muted)]">Paket stüdyosu</span><h2 className="text-lg font-black tracking-[-.03em] text-[var(--forest)]">Yeni sürpriz paket</h2></div></div>
          <button onClick={close} className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] bg-white" aria-label="Pencereyi kapat"><X size={17} /></button>
        </div>
        {created ? (
          <div className="grid min-h-[520px] place-items-center p-7 text-center">
            <div><div className="mx-auto grid h-20 w-20 place-items-center rounded-[22px] bg-[var(--lime)] text-[var(--forest)]"><Check size={34} /></div><span className="mt-7 block text-[10px] font-black uppercase tracking-[.15em] text-[var(--lime-dark)]">Yayın tamamlandı</span><h3 className="mt-2 text-4xl font-black tracking-[-.055em] text-[var(--forest)]">Paket kullanıcılarla buluştu.</h3><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">8 adet paket bugün 20:00–20:30 teslim aralığıyla keşfet akışında yayında.</p><button onClick={close} className="admin-primary-button mt-7">Panele dön <ArrowUpRight size={16} /></button></div>
          </div>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); setCreated(true); }} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
            <div className="mb-2 rounded-[16px] bg-[var(--forest)] p-5 text-white sm:col-span-2"><div className="flex items-center justify-between"><div><span className="text-[9px] font-black uppercase tracking-[.14em] text-[var(--lime)]">Canlı önizleme</span><strong className="mt-1 block text-xl">Günün Fırın Paketi</strong><span className="text-[10px] text-white/45">20:00–20:30 · 8 adet</span></div><strong className="text-3xl text-[var(--lime)]">139 ₺</strong></div></div>
            <label className="form-label sm:col-span-2">Paket adı<input defaultValue="Günün Fırın Paketi" className="form-input" /></label>
            <label className="form-label">Kategori<select className="form-input"><option>Fırın</option><option>Kafe</option><option>Market</option><option>Restoran</option></select></label>
            <label className="form-label">Adet<input type="number" defaultValue="8" className="form-input" /></label>
            <label className="form-label">Normal değer<input defaultValue="420 ₺" className="form-input" /></label>
            <label className="form-label">Satış fiyatı<input defaultValue="139 ₺" className="form-input" /></label>
            <label className="form-label">Teslim başlangıcı<input type="time" defaultValue="20:00" className="form-input" /></label>
            <label className="form-label">Teslim bitişi<input type="time" defaultValue="20:30" className="form-input" /></label>
            <label className="form-label sm:col-span-2">Tahmini içerik<textarea className="form-input min-h-28 resize-none" defaultValue="Günlük kruvasan, ekşi mayalı ekmek ve tatlılardan oluşan sürpriz paket." /></label>
            <button className="admin-primary-button mt-2 justify-center py-4 sm:col-span-2">Paketi yayınla <ArrowUpRight size={16} /></button>
          </form>
        )}
      </div>
    </div>
  );
}
