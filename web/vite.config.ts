import vinext from "vinext";
import { defineConfig, type UserConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

// Web istemcisi kendi veritabanını kullanmaz: tüm veri YePaket API'sinden
// gelir. Şablondan devralınan D1/R2 bağlamaları kaldırıldı.

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
};

export default defineConfig(async (): Promise<UserConfig> => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  // Konteyner veya sanal makine içinde çalışırken sunucunun yalnızca
  // 127.0.0.1'e bağlanması dışarıdan erişimi imkânsız kılar. DEV_SERVER_HOST
  // verildiğinde tüm arayüzleri dinler; bind mount üzerinden dosya
  // değişikliklerini yakalamak için de yoklama gerekir (macOS'ta FSEvents
  // konteynere ulaşmaz).
  const devHost = process.env.DEV_SERVER_HOST;
  const needsPolling = isCodexSeatbeltSandbox || Boolean(devHost);

  return {
    server: {
      // allowedHosts: Vite, DNS yeniden bağlama saldırısına karşı beklenmeyen
      // Host başlıklarını reddeder. Konteynerden erişimde istek
      // `host.docker.internal` gibi bir adla gelir ve 403 alır. Yalnızca
      // DEV_SERVER_HOST verildiğinde (bilinçli olarak dışarı açıldığında)
      // gevşetilir; varsayılan geliştirme akışı korumalı kalır.
      ...(devHost ? { host: devHost, strictPort: true, allowedHosts: true } : {}),
      ...(needsPolling ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
