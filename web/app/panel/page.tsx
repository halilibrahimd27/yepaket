import {
  apiRequestSafe,
  type PartnerBag,
  type PartnerDashboard,
  type PartnerOrder,
  type PayoutSummary,
} from "@/lib/api";
import { getAccessToken, requireUser } from "@/lib/session";
import { DashboardPage } from "../components/DashboardPage";

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

  const [dashboard, bags, orders, payout] = await Promise.all([
    apiRequestSafe<PartnerDashboard | null>("/partner/dashboard", null, { accessToken }),
    apiRequestSafe<PartnerBag[]>("/partner/bags", [], { accessToken }),
    apiRequestSafe<PartnerOrder[]>("/partner/orders", [], { accessToken }),
    apiRequestSafe<PayoutSummary | null>("/partner/payouts/summary", null, { accessToken }),
  ]);

  return (
    <DashboardPage
      user={user}
      dashboard={dashboard.data}
      bags={bags.data}
      orders={orders.data}
      payout={payout.data}
      loadFailed={dashboard.failed}
    />
  );
}
