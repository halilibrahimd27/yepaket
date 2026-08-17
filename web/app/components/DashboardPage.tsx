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
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  PackagePlus,
  PackageSearch,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
  TriangleAlert,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import gsap from "gsap";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  formatMoney,
  formatPickupWindow,
  type PartnerBag,
  type PartnerDashboard,
  type PartnerOrder,
  type PayoutSummary,
  type SessionUser,
} from "@/lib/api";

export interface DashboardProps {
  user: SessionUser;
  dashboard: PartnerDashboard | null;
  bags: PartnerBag[];
  orders: PartnerOrder[];
  payout: PayoutSummary | null;
  loadFailed: boolean;
}

type PanelTab = "Genel Bakış" | "Paketler" | "Siparişler" | "Gelir" | "Mağaza";

const menu: { label: PanelTab; shortLabel: string; icon: typeof LayoutDashboard }[] = [
  { label: "Genel Bakış", shortLabel: "Özet", icon: LayoutDashboard },
  { label: "Paketler", shortLabel: "Paketler", icon: ShoppingBag },
  { label: "Siparişler", shortLabel: "Siparişler", icon: PackageSearch },
  { label: "Gelir", shortLabel: "Gelir", icon: BarChart3 },
  { label: "Mağaza", shortLabel: "Mağaza", icon: Store },
];

const STATUS_LABELS: Record<string, string> = {
  payment_pending: "Ödeme bekliyor",
  paid: "Ödendi",
  pickup_pending: "Teslim bekliyor",
  collected: "Teslim edildi",
  cancelled: "İptal edildi",
  refunded: "İade edildi",
  no_show: "Gelinmedi",
};

/**
 * Panelden API'ye giden istekler vekil üzerinden geçer; erişim jetonu
 * httpOnly çerezde kalır ve istemci JavaScript'ine hiç açılmaz.
 */
async function partnerAction(
  path: string,
  method: string,
  payload?: unknown,
): Promise<{ ok: boolean; message?: string }> {
  const response = await fetch("/api/partner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, method, payload }),
  });

  if (response.ok) return { ok: true };

  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  return { ok: false, message: body.error?.message ?? "İşlem tamamlanamadı." };
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("tr-TR");
}

export function DashboardPage({ dashboard, bags, orders, payout, loadFailed }: DashboardProps) {
  const router = useRouter();
  const [tab, setTab] = useState<PanelTab>("Genel Bakış");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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

  /**
   * Eylemi çalıştırıp sunucu verisini tazeler.
   *
   * İyimser güncelleme yerine tek gerçeğe dönmek tercih edildi: stok ve
   * sipariş durumu aynı anda müşteriler tarafından da değiştiriliyor.
   */
  const runAction = async (key: string, path: string, method: string, payload?: unknown) => {
    setBusyKey(key);
    setActionError(null);

    const result = await partnerAction(path, method, payload);
    if (result.ok) router.refresh();
    else setActionError(result.message ?? null);

    setBusyKey(null);
    return result.ok;
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };

  return (
    <div ref={rootRef} className="min-h-screen bg-[var(--cream)] text-[var(--ink)]">
      <AdminHeader
        storeName={dashboard?.store.name ?? "İşletmem"}
        tab={tab}
        setTab={selectTab}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        setCreateOpen={setCreateOpen}
        pendingPickups={dashboard?.pending_pickups ?? 0}
        onLogout={logout}
      />

      {(loadFailed || actionError) && (
        <div className="fixed inset-x-0 top-[84px] z-40 px-3 sm:px-4">
          <div
            role="alert"
            className="mx-auto flex max-w-[1560px] items-start gap-3 rounded-[14px] border border-[#e65d4f]/30 bg-[#fdecea] px-4 py-3 text-sm font-semibold text-[#b23b2f] shadow-lg"
          >
            <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            {actionError ?? "Panel verileri yüklenemedi. Bağlantı geri geldiğinde sayfayı yenileyin."}
          </div>
        </div>
      )}

      <main>
        {tab === "Genel Bakış" && (
          <Overview dashboard={dashboard} orders={orders} setTab={selectTab} setCreateOpen={setCreateOpen} />
        )}
        {tab === "Paketler" && (
          <BagsPanel
            bags={bags}
            busyKey={busyKey}
            onToggle={(bag, publish) =>
              runAction(`bag-${bag.id}`, `/partner/bags/${bag.id}/${publish ? "publish" : "pause"}`, "POST")
            }
            setCreateOpen={setCreateOpen}
          />
        )}
        {tab === "Siparişler" && (
          <OrdersPanel
            orders={orders}
            busyKey={busyKey}
            onConfirm={(order, code) =>
              runAction(`order-${order.id}`, `/partner/orders/${order.id}/confirm-pickup`, "POST", {
                pickupCode: code,
              })
            }
          />
        )}
        {tab === "Gelir" && <RevenuePanel payout={payout} dashboard={dashboard} />}
        {tab === "Mağaza" && (
          <StorePanel
            dashboard={dashboard}
            busyKey={busyKey}
            onSave={(payload) => runAction("store", "/partner/store", "PATCH", payload)}
          />
        )}
      </main>

      {createOpen && (
        <CreateBagModal
          close={() => setCreateOpen(false)}
          onCreate={(payload) => runAction("create-bag", "/partner/bags", "POST", payload)}
          busy={busyKey === "create-bag"}
        />
      )}
    </div>
  );
}

function AdminHeader({
  storeName,
  tab,
  setTab,
  mobileMenuOpen,
  setMobileMenuOpen,
  setCreateOpen,
  pendingPickups,
  onLogout,
}: {
  storeName: string;
  tab: PanelTab;
  setTab: (tab: PanelTab) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (value: boolean) => void;
  setCreateOpen: (value: boolean) => void;
  pendingPickups: number;
  onLogout: () => void;
}) {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 p-3 sm:p-4">
        <div className="mx-auto flex h-16 max-w-[1560px] items-center justify-between rounded-[17px] border border-white/10 bg-[#072d24]/95 px-3 shadow-[0_20px_60px_rgba(5,31,24,.18)] backdrop-blur-xl sm:px-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="YePaket ana sayfa">
            <img src="/images/yep-logo.png" alt="" aria-hidden="true" className="h-10 w-10 rounded-[12px] object-cover" />
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
                aria-current={tab === item.label ? "page" : undefined}
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
              <span className="max-w-[160px] truncate text-[10px] font-black uppercase tracking-[.12em] text-white/55">
                {storeName}
              </span>
            </div>

            <span
              className="relative grid h-10 w-10 place-items-center rounded-[10px] border border-white/10 text-white/75"
              aria-label={`Teslim bekleyen sipariş: ${pendingPickups}`}
            >
              <Bell size={17} aria-hidden="true" />
              {pendingPickups > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--lime)] px-1 text-[9px] font-black text-[var(--forest)]">
                  {pendingPickups}
                </span>
              )}
            </span>

            <button
              onClick={() => setCreateOpen(true)}
              className="hidden h-10 items-center gap-2 rounded-[10px] bg-[var(--lime)] px-4 text-xs font-black text-[var(--forest)] transition hover:bg-white sm:flex"
            >
              Yeni paket <ArrowUpRight size={15} aria-hidden="true" />
            </button>

            <button
              onClick={() => setMobileMenuOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-[10px] border border-white/10 text-white lg:hidden"
              aria-label="Panel menüsünü aç"
            >
              <Menu size={19} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[70] bg-[var(--forest)] p-5 text-white transition lg:hidden ${
          mobileMenuOpen ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/yep-logo.png" alt="" aria-hidden="true" className="h-11 w-11 rounded-[13px] object-cover" />
            <strong className="text-xl">YePaket MyStore</strong>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10"
            aria-label="Menüyü kapat"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="mt-14 space-y-2">
          {menu.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => setTab(item.label)}
                className={`flex w-full items-center gap-4 rounded-[18px] border px-4 py-4 text-left ${
                  tab === item.label
                    ? "border-[var(--lime)] bg-[var(--lime)] text-[var(--forest)]"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <span className="text-[10px] font-black opacity-50">{String(index + 1).padStart(2, "0")}</span>
                <Icon size={20} aria-hidden="true" />
                <strong>{item.label}</strong>
                <ChevronRight className="ml-auto" size={18} aria-hidden="true" />
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => {
            setCreateOpen(true);
            setMobileMenuOpen(false);
          }}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-[16px] bg-white py-4 font-black text-[var(--forest)]"
        >
          <Plus size={18} aria-hidden="true" /> Yeni paket oluştur
        </button>

        <div className="absolute inset-x-5 bottom-6 border-t border-white/10 pt-5">
          <button
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm text-white/70"
          >
            <LogOut size={17} aria-hidden="true" /> Çıkış yap
          </button>
        </div>
      </div>
    </>
  );
}

function Overview({
  dashboard,
  orders,
  setTab,
  setCreateOpen,
}: {
  dashboard: PartnerDashboard | null;
  orders: PartnerOrder[];
  setTab: (tab: PanelTab) => void;
  setCreateOpen: (value: boolean) => void;
}) {
  const metrics = [
    {
      index: "01",
      label: "Bugünkü ciro",
      value: dashboard ? formatMoney(dashboard.today.revenue) : "—",
      note: `${dashboard?.today.order_count ?? 0} sipariş`,
      icon: Coins,
      tone: "lime",
    },
    {
      index: "02",
      label: "Kurtarılan paket",
      value: `${dashboard?.today.rescued_bags ?? 0}`,
      note: "Bugün",
      icon: Leaf,
      tone: "white",
    },
    {
      index: "03",
      label: "Bekleyen teslim",
      value: `${dashboard?.pending_pickups ?? 0}`,
      note: `${dashboard?.pickups_within_hour ?? 0} teslim yakın`,
      icon: ShoppingBag,
      tone: "white",
    },
    {
      index: "04",
      label: "Yeni müşteri",
      value: `${dashboard?.today.new_customers ?? 0}`,
      note: "İlk kez sipariş verdi",
      icon: UsersRound,
      tone: "forest",
    },
  ];

  const series = dashboard?.daily_series ?? [];
  const peak = Math.max(1, ...series.map((point) => point.rescued_bags));
  const activeBags = dashboard?.active_bags ?? [];

  return (
    <>
      <section className="admin-grid-bg overflow-hidden bg-[var(--forest)] px-5 pb-20 pt-28 text-white sm:px-8 sm:pb-24 sm:pt-32">
        <div className="mx-auto grid max-w-[1480px] gap-12 xl:grid-cols-[1.08fr_.92fr] xl:items-center">
          <div data-panel-intro>
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[.18em] text-white/50">
              <span className="h-2 w-2 rounded-full bg-[var(--lime)] shadow-[0_0_0_5px_rgba(199,242,43,.1)]" />
              {dashboard?.store.name ?? "İşletmem"} · Canlı operasyon merkezi
            </div>

            <h1 className="admin-display mt-8 max-w-[830px] text-[clamp(3.2rem,7vw,7.4rem)] font-black">
              İyi yemek<br />
              <span className="text-[var(--lime)]">satılır.</span><br />
              İsraf edilmez.
            </h1>

            <p className="mt-7 max-w-xl text-sm font-medium leading-7 text-white/55 sm:text-base">
              Bugünün üretimini, teslim akışını ve kazancını tek ekranda yönet.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-3 rounded-[11px] bg-[var(--lime)] px-5 py-4 text-sm font-black text-[var(--forest)] transition hover:bg-white"
              >
                Paket oluştur <ArrowUpRight size={17} aria-hidden="true" />
              </button>
              <button
                onClick={() => setTab("Siparişler")}
                className="flex items-center gap-3 rounded-[11px] border border-white/15 px-5 py-4 text-sm font-black text-white transition hover:bg-white/10"
              >
                Canlı siparişler <ChevronRight size={17} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/10 pt-6">
              <div>
                <strong className="block text-xl text-[var(--lime)]">
                  {dashboard?.lifetime.rescued_bags ?? 0}
                </strong>
                <span className="text-[10px] uppercase tracking-[.12em] text-white/35">toplam kurtarılan</span>
              </div>
              <div>
                <strong className="block text-xl">
                  {dashboard ? dashboard.lifetime.rating.overall.toFixed(1) : "—"}/5
                </strong>
                <span className="text-[10px] uppercase tracking-[.12em] text-white/35">
                  müşteri puanı ({dashboard?.lifetime.rating.count ?? 0})
                </span>
              </div>
            </div>
          </div>

          <div data-panel-intro className="relative mx-auto w-full max-w-[650px] xl:mx-0 xl:ml-auto">
            <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#edf0e8] p-3 shadow-[0_45px_100px_rgba(0,0,0,.3)] sm:p-4">
              <div className="flex items-center justify-between rounded-[18px] bg-white px-4 py-3 text-[var(--forest)]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--lime-dark)]" />
                  <strong className="text-xs">Bugünün operasyonu</strong>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[.12em] text-[var(--muted)]">
                  {new Intl.DateTimeFormat("tr-TR", {
                    day: "numeric",
                    month: "long",
                    timeZone: "Europe/Istanbul",
                  }).format(new Date())}
                </span>
              </div>

              <div className="mt-3 grid gap-2">
                {orders.slice(0, 4).map((order) => (
                  <div key={order.id} className="flex items-center gap-3 rounded-[16px] bg-white p-3 text-[var(--ink)]">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--lime-soft)] text-xs font-black text-[var(--forest)]">
                      {initials(order.customer_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-xs">
                        {order.customer_name} · {order.order_no}
                      </strong>
                      <span className="block truncate text-[10px] text-[var(--muted)]">{order.bag_title}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <strong className="block text-xs text-[var(--forest)]">{formatMoney(order.total)}</strong>
                      <span className="text-[9px] font-black text-[var(--muted)]">
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                  </div>
                ))}

                {orders.length === 0 && (
                  <p className="rounded-[16px] bg-white p-6 text-center text-xs text-[var(--muted)]">
                    Henüz sipariş yok. Paket yayınladığında burada görünecek.
                  </p>
                )}
              </div>
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
            {metrics.map(({ index, label, value, note, icon: Icon, tone }) => (
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
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-black tracking-[.16em] opacity-45">{index}</span>
                  <Icon size={21} aria-hidden="true" />
                </div>
                <div className="mt-16">
                  <span className="text-[11px] font-extrabold opacity-55">{label}</span>
                  <strong className="mt-1 block text-4xl font-black tracking-[-.055em]">{value}</strong>
                </div>
                <div className="mt-5 flex items-center gap-2 border-t border-current/10 pt-4 text-[10px] font-black">
                  <TrendingUp size={14} aria-hidden="true" />
                  {note}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
            <article data-panel-intro className="rounded-[22px] border border-[var(--line)] bg-white p-5 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--lime-dark)]">
                    7 günlük görünüm
                  </span>
                  <h2 className="mt-2 text-2xl font-black tracking-[-.04em] text-[var(--forest)]">
                    Paket kurtarma ritmi
                  </h2>
                </div>
                <span className="flex w-fit items-center gap-2 rounded-[10px] border border-[var(--line)] px-3 py-2 text-[10px] font-black text-[var(--muted)]">
                  <CalendarDays size={14} aria-hidden="true" /> Son 7 gün
                </span>
              </div>

              {series.length === 0 ? (
                <p className="mt-10 rounded-[14px] bg-[var(--cream)] py-14 text-center text-sm text-[var(--muted)]">
                  Henüz veri yok.
                </p>
              ) : (
                <div className="mt-10 flex h-64 items-end gap-2 sm:gap-4">
                  {series.map((point) => (
                    <div key={point.date} className="group flex flex-1 flex-col items-center gap-3">
                      <span className="text-[9px] font-black text-[var(--muted)] opacity-0 transition group-hover:opacity-100">
                        {point.rescued_bags}
                      </span>
                      <div className="relative flex h-48 w-full items-end overflow-hidden rounded-[8px] bg-[var(--cream)]">
                        <div
                          className="w-full rounded-[8px] bg-[var(--forest)] transition-all group-hover:bg-[var(--lime-dark)]"
                          style={{ height: `${Math.max(6, (point.rescued_bags / peak) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-black uppercase text-[var(--muted)]">
                        {new Intl.DateTimeFormat("tr-TR", {
                          weekday: "short",
                          timeZone: "Europe/Istanbul",
                        }).format(new Date(point.date))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article data-panel-intro className="rounded-[22px] bg-[var(--forest)] p-5 text-white sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--lime)]">
                    Şu an yayında
                  </span>
                  <h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Canlı paketler</h2>
                </div>
                <span className="rounded-[8px] bg-white/10 px-2.5 py-1.5 text-[9px] font-black">
                  {activeBags.length} AKTİF
                </span>
              </div>

              <div className="mt-7 space-y-2">
                {activeBags.slice(0, 4).map((bag) => (
                  <button
                    key={bag.id}
                    onClick={() => setTab("Paketler")}
                    className="flex w-full items-center gap-3 rounded-[14px] border border-white/8 bg-white/5 p-3 text-left transition hover:bg-white/10"
                  >
                    <img
                      src={bag.image_urls[0] ?? "/images/bag-bakery.jpg"}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="h-12 w-12 rounded-[11px] object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-xs">{bag.title}</strong>
                      <span className="block truncate text-[9px] text-white/40">
                        {formatPickupWindow(bag.pickup_window)} · {formatMoney(bag.sale_price)}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <strong className="block text-base text-[var(--lime)]">{bag.available_quantity}</strong>
                      <span className="text-[8px] uppercase text-white/35">kaldı</span>
                    </div>
                  </button>
                ))}

                {activeBags.length === 0 && (
                  <p className="rounded-[14px] border border-white/10 bg-white/5 p-6 text-center text-xs text-white/60">
                    Yayında paket yok.
                  </p>
                )}
              </div>

              <button
                onClick={() => setCreateOpen(true)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--lime)] py-3.5 text-xs font-black text-[var(--forest)] transition hover:bg-white"
              >
                <Plus size={15} aria-hidden="true" /> Hızlı paket ekle
              </button>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}

function BagsPanel({
  bags,
  busyKey,
  onToggle,
  setCreateOpen,
}: {
  bags: PartnerBag[];
  busyKey: string | null;
  onToggle: (bag: PartnerBag, publish: boolean) => void;
  setCreateOpen: (value: boolean) => void;
}) {
  return (
    <PanelPage>
      <PanelPageHeader
        index="02"
        eyebrow="Paket stüdyosu"
        title={<>Üretimi planla.<br /><span className="text-[var(--lime-dark)]">Stoğu değerlendir.</span></>}
        description="Sürpriz paketlerini planla, yayınla ve satışını izle."
        action={
          <button onClick={() => setCreateOpen(true)} className="admin-primary-button">
            <Plus size={16} aria-hidden="true" /> Yeni paket
          </button>
        }
      />

      {bags.length === 0 ? (
        <p className="mt-12 rounded-[20px] border border-dashed border-[var(--forest)]/20 bg-white py-20 text-center text-[var(--muted)]">
          Henüz paket oluşturmadın.
        </p>
      ) : (
        <div className="mt-12 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {bags.map((bag, index) => {
            const published = bag.status === "published";
            const busy = busyKey === `bag-${bag.id}`;

            return (
              <article key={bag.id} data-panel-intro className="group overflow-hidden rounded-[20px] border border-[var(--line)] bg-white">
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={bag.image_urls[0] ?? "/images/bag-bakery.jpg"}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--forest)]/80 via-transparent to-transparent" />
                  <span className="absolute left-4 top-4 rounded-[9px] bg-white/90 px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] text-[var(--forest)]">
                    {String(index + 1).padStart(2, "0")} · {bag.category}
                  </span>
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 text-white">
                    <div className="min-w-0">
                      <span className="text-[9px] uppercase tracking-[.12em] text-white/55">Teslim</span>
                      <strong className="block truncate text-sm">{formatPickupWindow(bag.pickup_window)}</strong>
                    </div>
                    <strong className="shrink-0 text-2xl text-[var(--lime)]">{formatMoney(bag.sale_price)}</strong>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-black tracking-[-.035em] text-[var(--forest)]">{bag.title}</h2>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {bag.sold_quantity} satıldı · {bag.order_count} sipariş
                      </p>
                    </div>

                    <button
                      onClick={() => onToggle(bag, !published)}
                      disabled={busy}
                      aria-label={`${bag.title} paketini ${published ? "durdur" : "yayına al"}`}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
                        published ? "bg-[var(--lime-dark)]" : "bg-black/15"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                          published ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-3 border-y border-[var(--line)] py-4 text-center">
                    <div>
                      <strong className="block text-xl text-[var(--forest)]">{bag.available_quantity}</strong>
                      <span className="text-[9px] uppercase text-[var(--muted)]">Kalan</span>
                    </div>
                    <div className="border-x border-[var(--line)]">
                      <strong className="block text-xl text-[var(--forest)]">{bag.sold_quantity}</strong>
                      <span className="text-[9px] uppercase text-[var(--muted)]">Satılan</span>
                    </div>
                    <div>
                      <strong className="block text-xl text-[var(--forest)]">%{bag.discount_percent}</strong>
                      <span className="text-[9px] uppercase text-[var(--muted)]">İndirim</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.1em] ${
                        published ? "text-[var(--lime-dark)]" : "text-[var(--muted)]"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${published ? "bg-[var(--lime-dark)]" : "bg-black/20"}`} />
                      {published ? "Yayında" : bag.status === "sold_out" ? "Tükendi" : "Durduruldu"}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setCreateOpen(true)}
        data-panel-intro
        className="mt-4 flex min-h-36 w-full items-center justify-center gap-4 rounded-[20px] border border-dashed border-[var(--forest)]/25 bg-[var(--lime-soft)]/40 px-5 text-[var(--forest)] transition hover:bg-[var(--lime-soft)]"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--forest)] text-white">
          <PackagePlus size={19} aria-hidden="true" />
        </span>
        <span className="text-left">
          <strong className="block">Yeni bir paket fikrin mi var?</strong>
          <span className="text-xs text-[var(--muted)]">Teslim zamanı, stok ve fiyatı birkaç adımda belirle.</span>
        </span>
      </button>
    </PanelPage>
  );
}

function OrdersPanel({
  orders,
  busyKey,
  onConfirm,
}: {
  orders: PartnerOrder[];
  busyKey: string | null;
  onConfirm: (order: PartnerOrder, code: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const counts = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((order) => order.status === "pickup_pending").length,
      collected: orders.filter((order) => order.status === "collected").length,
    }),
    [orders],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    return orders.filter((order) => {
      if (filter === "pending" && order.status !== "pickup_pending") return false;
      if (filter === "collected" && order.status !== "collected") return false;
      if (!term) return true;
      return (
        order.order_no.toLocaleLowerCase("tr-TR").includes(term) ||
        order.customer_name.toLocaleLowerCase("tr-TR").includes(term) ||
        order.bag_title.toLocaleLowerCase("tr-TR").includes(term)
      );
    });
  }, [orders, filter, search]);

  return (
    <PanelPage>
      <PanelPageHeader
        index="03"
        eyebrow="Teslim masası"
        title={<>Her siparişin<br /><span className="text-[var(--lime-dark)]">bir sırası var.</span></>}
        description="Müşteri teslim kodunu gösterdiğinde siparişi tamamla."
      />

      <div className="mt-12 grid gap-3 sm:grid-cols-3">
        {([
          ["Toplam", counts.total, "Tüm siparişler"],
          ["Teslim bekleyen", counts.pending, "Şu an"],
          ["Teslim edilen", counts.collected, "Tamamlanan"],
        ] as const).map(([label, value, note], index) => (
          <article
            key={label}
            data-panel-intro
            className={`rounded-[18px] border p-5 ${
              index === 1 ? "border-[var(--lime)] bg-[var(--lime)]" : "border-[var(--line)] bg-white"
            }`}
          >
            <span className="text-[9px] font-black uppercase tracking-[.14em] text-[var(--muted)]">
              0{index + 1} · {label}
            </span>
            <div className="mt-8 flex items-end justify-between">
              <strong className="text-5xl font-black tracking-[-.06em] text-[var(--forest)]">{value}</strong>
              <span className="pb-1 text-[10px] font-bold text-[var(--muted)]">{note}</span>
            </div>
          </article>
        ))}
      </div>

      <section data-panel-intro className="mt-4 rounded-[20px] border border-[var(--line)] bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto">
            {([
              ["all", `Tümü ${counts.total}`],
              ["pending", `Bekleyen ${counts.pending}`],
              ["collected", `Tamamlanan ${counts.collected}`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`shrink-0 rounded-[9px] px-3 py-2 text-[10px] font-black ${
                  filter === key ? "bg-[var(--forest)] text-white" : "bg-[var(--cream)] text-[var(--muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 rounded-[10px] border border-[var(--line)] px-3 py-2 text-[var(--muted)]">
            <Search size={14} aria-hidden="true" />
            <input
              aria-label="Sipariş veya müşteri ara"
              placeholder="Sipariş veya müşteri ara"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent text-xs outline-none sm:w-52"
            />
          </label>
        </div>

        <OrdersTable orders={visible} busyKey={busyKey} onConfirm={onConfirm} />
      </section>
    </PanelPage>
  );
}

function OrdersTable({
  orders,
  busyKey,
  onConfirm,
}: {
  orders: PartnerOrder[];
  busyKey: string | null;
  onConfirm: (order: PartnerOrder, code: string) => void;
}) {
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [code, setCode] = useState("");

  if (orders.length === 0) {
    return <p className="py-16 text-center text-sm text-[var(--muted)]">Bu filtreye uygun sipariş yok.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--line)] text-[9px] font-black uppercase tracking-[.12em] text-[var(--muted)]">
            <th className="px-3 py-4">Sipariş</th>
            <th className="px-3 py-4">Müşteri</th>
            <th className="px-3 py-4">Paket</th>
            <th className="px-3 py-4">Teslim</th>
            <th className="px-3 py-4">Tutar</th>
            <th className="px-3 py-4">Durum</th>
            <th className="px-3 py-4" />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const busy = busyKey === `order-${order.id}`;
            const entering = codeFor === order.id;

            return (
              <tr key={order.id} className="border-b border-[var(--line)] text-xs last:border-0 hover:bg-[var(--cream)]/50">
                <td className="px-3 py-4 font-black text-[var(--forest)]">{order.order_no}</td>
                <td className="px-3 py-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--lime-soft)] text-[9px] font-black text-[var(--forest)]">
                      {initials(order.customer_name)}
                    </span>
                    <strong>{order.customer_name}</strong>
                  </div>
                </td>
                <td className="px-3 py-4 text-[var(--muted)]">{order.bag_title}</td>
                <td className="px-3 py-4">
                  <span className="inline-flex items-center gap-1.5 font-bold text-[var(--forest)]">
                    <Clock3 size={13} aria-hidden="true" />
                    {formatPickupWindow(order.pickup_window)}
                  </span>
                </td>
                <td className="px-3 py-4 font-black">{formatMoney(order.total)}</td>
                <td className="px-3 py-4">
                  <span
                    className={`rounded-[8px] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[.06em] ${
                      order.status === "collected"
                        ? "bg-[#e7f8ef] text-[#13834f]"
                        : order.status === "pickup_pending"
                          ? "bg-[#fff7d9] text-[#8a6a00]"
                          : "bg-[var(--cream)] text-[var(--muted)]"
                    }`}
                  >
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </td>
                <td className="px-3 py-4 text-right">
                  {order.status !== "pickup_pending" ? (
                    <span className="text-[9px] text-[var(--muted)]">—</span>
                  ) : entering ? (
                    <span className="inline-flex items-center gap-1">
                      <input
                        ref={(element) => element?.focus()}
                        inputMode="numeric"
                        maxLength={6}
                        value={code}
                        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                        placeholder="6 hane"
                        aria-label="Teslim kodu"
                        className="w-20 rounded-[8px] border border-[var(--line)] px-2 py-1.5 text-[10px] outline-none"
                      />
                      <button
                        disabled={busy || code.length !== 6}
                        onClick={() => {
                          onConfirm(order, code);
                          setCodeFor(null);
                          setCode("");
                        }}
                        className="rounded-[8px] bg-[var(--forest)] px-2 py-1.5 text-[9px] font-black text-white disabled:opacity-40"
                      >
                        Onayla
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setCodeFor(order.id);
                        setCode("");
                      }}
                      className="rounded-[8px] bg-[var(--forest)] px-3 py-2 text-[9px] font-black text-white hover:bg-[var(--lime-dark)]"
                    >
                      Teslim et
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RevenuePanel({
  payout,
  dashboard,
}: {
  payout: PayoutSummary | null;
  dashboard: PartnerDashboard | null;
}) {
  const series = dashboard?.daily_series ?? [];
  const peak = Math.max(1, ...series.map((point) => point.revenue.amount_minor));

  return (
    <PanelPage>
      <PanelPageHeader
        index="04"
        eyebrow="Gelir & hakediş"
        title={<>İsraf azalırken<br /><span className="text-[var(--lime-dark)]">kazanç büyür.</span></>}
        description="Brüt satış, platform hizmeti, iade ve net hakedişin aynı görünümde."
      />

      {payout && !payout.payout_ready && (
        <div
          role="alert"
          className="mt-8 flex items-start gap-3 rounded-[16px] border border-[#f6b91c]/40 bg-[#fff8e6] px-4 py-3 text-sm font-semibold text-[#8a6a00]"
        >
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          Hakediş ödemesi için IBAN ve vergi bilgilerin eksik. YePaket ekibiyle iletişime geçerek
          tamamlayabilirsin.
        </div>
      )}

      <div className="mt-8 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <article data-panel-intro className="admin-grid-bg min-h-[410px] rounded-[22px] bg-[var(--forest)] p-6 text-white sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--lime)]">
                {payout ? `${payout.period.label} net hakediş` : "Net hakediş"}
                {payout?.is_estimate ? " (tahmini)" : ""}
              </span>
              <strong className="mt-4 block text-[clamp(2.6rem,6vw,5.6rem)] font-black leading-none tracking-[-.075em]">
                {payout ? formatMoney(payout.net) : "—"}
              </strong>
            </div>
            <WalletCards className="shrink-0 text-[var(--lime)]" size={28} aria-hidden="true" />
          </div>

          <div className="mt-16 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
            <div>
              <span className="text-[9px] uppercase text-white/35">Komisyon oranı</span>
              <strong className="mt-1 block text-sm text-[var(--lime)]">
                %{payout ? (payout.commission_rate_bps / 100).toLocaleString("tr-TR") : "—"}
              </strong>
            </div>
            <div>
              <span className="text-[9px] uppercase text-white/35">Sipariş</span>
              <strong className="mt-1 block text-sm">{payout?.order_count ?? 0} adet</strong>
            </div>
            <div>
              <span className="text-[9px] uppercase text-white/35">Kurtarılan</span>
              <strong className="mt-1 block text-sm">{payout?.rescued_bags ?? 0} paket</strong>
            </div>
          </div>
        </article>

        <article data-panel-intro className="rounded-[22px] border border-[var(--line)] bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--muted)]">Son 7 gün</span>
              <h2 className="mt-2 text-2xl font-black text-[var(--forest)]">Satış ritmi</h2>
            </div>
            <TrendingUp className="text-[var(--lime-dark)]" aria-hidden="true" />
          </div>

          {series.length === 0 ? (
            <p className="mt-10 py-16 text-center text-sm text-[var(--muted)]">Henüz veri yok.</p>
          ) : (
            <>
              <div className="mt-10 flex h-48 items-end gap-2">
                {series.map((point) => (
                  <div
                    key={point.date}
                    title={formatMoney(point.revenue)}
                    className="flex-1 rounded-[6px] bg-[var(--forest)]"
                    style={{ height: `${Math.max(6, (point.revenue.amount_minor / peak) * 100)}%` }}
                  />
                ))}
              </div>
              <div className="mt-4 flex justify-between text-[9px] font-black uppercase text-[var(--muted)]">
                <span>7 gün önce</span>
                <span>Bugün</span>
              </div>
            </>
          )}
        </article>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          ["01", "Brüt satış", payout ? formatMoney(payout.gross) : "—"],
          ["02", "Platform hizmeti", payout ? `−${formatMoney(payout.commission)}` : "—"],
          ["03", "İade", payout ? `−${formatMoney(payout.refund)}` : "—"],
          ["04", "Net hakediş", payout ? formatMoney(payout.net) : "—"],
        ] as const).map(([index, label, value], itemIndex) => (
          <article
            key={label}
            data-panel-intro
            className={`rounded-[18px] border p-5 ${
              itemIndex === 3 ? "border-[var(--lime)] bg-[var(--lime)]" : "border-[var(--line)] bg-white"
            }`}
          >
            <span className="text-[9px] font-black uppercase tracking-[.12em] text-[var(--muted)]">{index}</span>
            <span className="mt-12 block text-[10px] font-bold text-[var(--muted)]">{label}</span>
            <strong className="mt-1 block text-2xl font-black text-[var(--forest)]">{value}</strong>
          </article>
        ))}
      </div>
    </PanelPage>
  );
}

function StorePanel({
  dashboard,
  busyKey,
  onSave,
}: {
  dashboard: PartnerDashboard | null;
  busyKey: string | null;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [saved, setSaved] = useState(false);
  const busy = busyKey === "store";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);

    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {};

    for (const key of ["name", "description", "phone", "addressLine", "openingTime", "closingTime"]) {
      const value = String(form.get(key) ?? "").trim();
      if (value) payload[key] = value;
    }

    if (await onSave(payload)) setSaved(true);
  }

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
          <div className="relative h-64">
            <img
              src={dashboard?.store.logo_url ?? "/images/bag-bakery.jpg"}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--forest)] via-transparent to-transparent" />
            <div className="absolute inset-x-5 bottom-5">
              <span className="text-[9px] font-black uppercase tracking-[.14em] text-[var(--lime)]">
                Uygulamadaki görünüm
              </span>
              <h2 className="mt-2 text-3xl font-black tracking-[-.05em]">{dashboard?.store.name ?? "İşletmem"}</h2>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <span className="text-[9px] text-white/35">Puan</span>
                <strong className="block text-xl text-[var(--lime)]">
                  {dashboard ? dashboard.store.rating.overall.toFixed(1) : "—"} / 5
                </strong>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-white/35">Kurtarılan</span>
                <strong className="block text-xl">{dashboard?.store.rescued_bag_count ?? 0} paket</strong>
              </div>
            </div>
            <p className="mt-5 text-xs leading-6 text-white/55">{dashboard?.store.address}</p>
          </div>
        </aside>

        <form
          onSubmit={submit}
          data-panel-intro
          className="grid gap-5 rounded-[22px] border border-[var(--line)] bg-white p-5 sm:grid-cols-2 sm:p-8"
        >
          <div className="sm:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--lime-dark)]">
              Temel bilgiler
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-[-.04em] text-[var(--forest)]">
              Mağaza profilini düzenle
            </h2>
          </div>

          <label className="form-label sm:col-span-2">
            İşletme adı
            <input name="name" className="form-input" defaultValue={dashboard?.store.name ?? ""} />
          </label>
          <label className="form-label">
            Telefon
            <input name="phone" className="form-input" placeholder="0216 555 42 42" />
          </label>
          <label className="form-label">
            Açılış saati
            <input name="openingTime" type="time" className="form-input" />
          </label>
          <label className="form-label sm:col-span-2">
            Adres
            <input name="addressLine" className="form-input" placeholder="Mahalle, cadde, no" />
          </label>
          <label className="form-label sm:col-span-2">
            Mağaza açıklaması
            <textarea name="description" className="form-input min-h-28 resize-none" />
          </label>

          <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-5 sm:col-span-2">
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#13834f]">
                <Check size={15} aria-hidden="true" /> Kaydedildi
              </span>
            )}
            <button disabled={busy} className="admin-primary-button disabled:opacity-60">
              {busy ? "Kaydediliyor..." : "Değişiklikleri kaydet"}
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
    </PanelPage>
  );
}

function PanelPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--cream)] px-5 pb-24 pt-32 sm:px-8 sm:pt-36">
      <div className="mx-auto max-w-[1480px]">{children}</div>
    </div>
  );
}

function PanelPageHeader({
  index,
  eyebrow,
  title,
  description,
  action,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      data-panel-intro
      className="flex flex-col gap-8 border-b border-[var(--line)] pb-10 lg:flex-row lg:items-end lg:justify-between"
    >
      <SectionIntro index={index} eyebrow={eyebrow} title={title} description={description} />
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function SectionIntro({
  index,
  eyebrow,
  title,
  description,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  description: string;
}) {
  return (
    <div className="max-w-[920px]">
      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[.16em] text-[var(--muted)]">
        <span className="text-[var(--lime-dark)]">{index}</span>
        <span className="h-px w-8 bg-[var(--line)]" />
        {eyebrow}
      </div>
      {/* leading .91 Türkçe büyük harf aksanlarını (İ, Ğ) üstten kırpıyordu. */}
      <h2 className="mt-5 text-[clamp(2.4rem,5.2vw,5rem)] font-black leading-[1] tracking-[-.07em] text-[var(--forest)]">
        {title}
      </h2>
      <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--muted)]">{description}</p>
    </div>
  );
}

/** Yeni paket oluşturma. Fiyatlar kuruşa çevrilerek gönderilir. */
function CreateBagModal({
  close,
  onCreate,
  busy,
}: {
  close: () => void;
  onCreate: (payload: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
}) {
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const date = String(form.get("date"));
    const start = String(form.get("start"));
    const end = String(form.get("end"));

    if (end <= start) {
      setError("Teslim bitişi başlangıçtan sonra olmalıdır.");
      return;
    }

    // Para her zaman kuruş olarak gönderilir; kayan noktalı aritmetik
    // yuvarlama hatası üretmesin diye tam sayıya çevrilir.
    const originalValueMinor = Math.round(Number(form.get("originalValue")) * 100);
    const salePriceMinor = Math.round(Number(form.get("salePrice")) * 100);

    if (salePriceMinor > originalValueMinor) {
      setError("Satış fiyatı normal değerden yüksek olamaz.");
      return;
    }

    const ok = await onCreate({
      title: String(form.get("title")),
      category: String(form.get("category")),
      description: String(form.get("description") || ""),
      originalValueMinor,
      salePriceMinor,
      quantity: Number(form.get("quantity")),
      pickupStartsAt: new Date(`${date}T${start}`).toISOString(),
      pickupEndsAt: new Date(`${date}T${end}`).toISOString(),
    });

    if (ok) setCreated(true);
    else setError("Paket oluşturulamadı. Bilgileri kontrol edip tekrar deneyin.");
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-end bg-[#06281f]/75 backdrop-blur-sm sm:place-items-center sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Yeni sürpriz paket"
        className="max-h-[94vh] w-full overflow-auto rounded-t-[28px] bg-[var(--cream)] shadow-2xl sm:max-w-[780px] sm:rounded-[24px]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[var(--cream)]/95 px-5 py-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--lime)] text-[var(--forest)]">
              <Sparkles size={17} aria-hidden="true" />
            </span>
            <div>
              <span className="text-[9px] font-black uppercase tracking-[.14em] text-[var(--muted)]">
                Paket stüdyosu
              </span>
              <h2 className="text-lg font-black tracking-[-.03em] text-[var(--forest)]">Yeni sürpriz paket</h2>
            </div>
          </div>
          <button
            onClick={close}
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] bg-white"
            aria-label="Pencereyi kapat"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        {created ? (
          <div className="grid min-h-[420px] place-items-center p-7 text-center">
            <div>
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-[22px] bg-[var(--lime)] text-[var(--forest)]">
                <Check size={34} aria-hidden="true" />
              </div>
              <h3 className="mt-6 text-3xl font-black tracking-[-.055em] text-[var(--forest)]">Paket yayında!</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
                Paketin keşfet akışında görünmeye başladı. Seni favorileyen kullanıcılara bildirim gitti.
              </p>
              <button onClick={close} className="admin-primary-button mt-7">
                Panele dön <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
            {error && (
              <div
                role="alert"
                className="rounded-[14px] border border-[#e65d4f]/30 bg-[#fdecea] px-4 py-3 text-sm font-semibold text-[#b23b2f] sm:col-span-2"
              >
                {error}
              </div>
            )}

            <label className="form-label sm:col-span-2">
              Paket adı
              <input required name="title" defaultValue="Günün Fırın Paketi" className="form-input" />
            </label>

            <label className="form-label">
              Kategori
              <select name="category" className="form-input">
                <option value="bakery">Fırın</option>
                <option value="cafe">Kafe</option>
                <option value="market">Market</option>
                <option value="restaurant">Restoran</option>
              </select>
            </label>

            <label className="form-label">
              Adet
              <input required name="quantity" type="number" min={1} max={200} defaultValue={8} className="form-input" />
            </label>

            <label className="form-label">
              Normal değer (₺)
              <input required name="originalValue" type="number" min={1} step="0.01" defaultValue={420} className="form-input" />
            </label>

            <label className="form-label">
              Satış fiyatı (₺)
              <input required name="salePrice" type="number" min={1} step="0.01" defaultValue={139} className="form-input" />
            </label>

            <label className="form-label sm:col-span-2">
              Teslim günü
              <input required name="date" type="date" min={today} defaultValue={today} className="form-input" />
            </label>

            <label className="form-label">
              Teslim başlangıcı
              <input required name="start" type="time" defaultValue="20:00" className="form-input" />
            </label>

            <label className="form-label">
              Teslim bitişi
              <input required name="end" type="time" defaultValue="20:30" className="form-input" />
            </label>

            <label className="form-label sm:col-span-2">
              Tahmini içerik
              <textarea
                name="description"
                className="form-input min-h-28 resize-none"
                defaultValue="Günlük kruvasan, ekşi mayalı ekmek ve tatlılardan oluşan sürpriz paket."
              />
            </label>

            <button
              disabled={busy}
              className="admin-primary-button mt-2 justify-center py-4 disabled:opacity-60 sm:col-span-2"
            >
              {busy ? "Yayınlanıyor..." : "Paketi yayınla"}
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
