"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Oturumu arka planda canlı tutar.
 *
 * Erişim jetonu 15 dakika yaşar. Yenileme yalnızca çerez yazabilen route
 * handler'da yapılabildiği için, o ucu jetonun ömrü dolmadan düzenli olarak
 * çağırmak gerekiyor. Bu bileşen olmadan panelde 15 dakika çalışan bir
 * kullanıcı, 60 günlük yenileme jetonu elinde olmasına rağmen girişe
 * atılırdı.
 *
 * Sekme arka plandayken tarayıcılar zamanlayıcıları kısar; bu yüzden sekmeye
 * geri dönüldüğünde de bir kez yenilenir.
 */

/** Erişim jetonu ömründen (15 dk) belirgin biçimde kısa. */
const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

/** Sekmeye dönüşte bu süreden eskiyse yenile. */
const STALE_AFTER_MS = 5 * 60 * 1000;

export function SessionKeeper() {
  const router = useRouter();

  useEffect(() => {
    let lastRefresh = Date.now();
    let cancelled = false;

    async function refresh() {
      if (cancelled) return;

      try {
        const response = await fetch("/api/auth/refresh", { method: "POST" });
        lastRefresh = Date.now();

        // 401: yenileme jetonu da geçersiz (çıkış yapıldı, şifre değişti veya
        // jeton çalınmış olarak işaretlendi). Sunucu çerezleri temizledi;
        // sayfayı tazelemek kullanıcıyı girişe yönlendirir.
        if (response.status === 401 && !cancelled) router.refresh();
      } catch {
        // Ağ hatası: bir sonraki denemede tekrar bakılır.
      }
    }

    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);

    function onVisible() {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh > STALE_AFTER_MS) {
        refresh();
      }
    }

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
