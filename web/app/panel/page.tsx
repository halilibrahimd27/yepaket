import {
  apiRequestSafe,
  type PartnerBag,
  type PartnerDashboard,
  type PartnerOrder,
  type PayoutSummary,
  type StoreProfile,
} from "@/lib/api";
import { getAccessToken, requireUser } from "@/lib/session";
import { DashboardPage } from "../components/DashboardPage";
import { SessionKeeper } from "../components/SessionKeeper";

export const metadata = { title: "MyStore — YePaket" };

/**
 * İşletme paneli.
 *
 * Sunucuda oturum doğrulanır: jetonsuz istek hiç render edilmeden girişe
 * yönlendirilir. İstemci tarafı bir kontrole güvenmek, sayfanın kaynağını
 * görüntüleyen herkese veriyi açardı.
 */
export default async function Panel() {
  const user = await requireUser("/panel", ["PARTNER", "ADMIN"]);
  const accessToken = await getAccessToken();

  const [dashboard, bags, orders, payout, store] = await Promise.all([
    apiRequestSafe<PartnerDashboard | null>("/partner/dashboard", null, { accessToken }),
    apiRequestSafe<PartnerBag[]>("/partner/bags", [], { accessToken }),
    apiRequestSafe<PartnerOrder[]>("/partner/orders", [], { accessToken }),
    apiRequestSafe<PayoutSummary | null>("/partner/payouts/summary", null, { accessToken }),
    // Mağaza düzenleme formu bu uçtan besleniyor; panel özeti telefon,
    // açıklama ve çalışma saatlerini taşımıyor.
    apiRequestSafe<StoreProfile | null>("/partner/store", null, { accessToken }),
  ]);

  return (
    <>
      {/* Erişim jetonu 15 dakikada dolar; panelde uzun süre çalışan
          kullanıcı bu bileşen olmadan girişe atılırdı. */}
      <SessionKeeper />
      <DashboardPage
        user={user}
        dashboard={dashboard.data}
        bags={bags.data}
        orders={orders.data}
        payout={payout.data}
        store={store.data}
        loadFailed={dashboard.failed}
      />
    </>
  );
}
