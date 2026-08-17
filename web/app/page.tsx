import { apiRequestSafe, type Bag, type CommunityImpact } from "@/lib/api";
import { LandingPage } from "./components/LandingPage";

/**
 * Tanıtım sayfası sunucuda render edilir: paketler arama motorlarına ve
 * JavaScript'i geç yüklenen ziyaretçilere de görünür.
 *
 * API'ye ulaşılamazsa sayfa yine açılır; paket bölümü boş durum gösterir.
 * Tanıtım sitesinin backend arızasında tamamen çökmesi kabul edilemez.
 */
export const revalidate = 60;

export default async function Home() {
  const [bags, impact] = await Promise.all([
    apiRequestSafe<Bag[]>("/bags/nearby?limit=8&sort=relevance", [], {
      revalidateSeconds: 60,
    }),
    apiRequestSafe<CommunityImpact | null>("/impact/community", null, {
      revalidateSeconds: 300,
    }),
  ]);

  return <LandingPage bags={bags.data} impact={impact.data} apiUnavailable={bags.failed} />;
}
