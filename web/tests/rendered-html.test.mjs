import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the YePaket landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>YePaket — İyi yemek çöpe gitmesin<\/title>/i);
  assert.match(html, /İyi yemek/);
  assert.match(html, /çöpe/);
  assert.match(html, /Google Play uygulama bilgileri/);
  assert.match(html, /App Store uygulama bilgileri/);
  assert.match(html, /data-hero=/);
  assert.match(html, /data-marquee=/);
  assert.match(html, /data-rescue-step=/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
});

test("keeps motion, SVG store icons and reduced-motion support in the product UI", async () => {
  const [landing, css, page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/components/LandingPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /LandingPage/);
  assert.match(layout, /YePaket — İyi yemek çöpe gitmesin/);
  assert.match(landing, /SiAppstore/);
  assert.match(landing, /SiGoogleplay/);
  assert.match(landing, /ScrollTrigger/);
  assert.match(landing, /data-parallax/);
  assert.match(landing, /data-rescue-step/);
  assert.doesNotMatch(landing, /▶|👋/);
  assert.match(css, /position:\s*sticky/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(packageJson, /"react-icons"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  // Şablon artıkları temizlendi; geri gelirlerse test uyarsın.
  await assert.rejects(access(new URL("../app/chatgpt-auth.ts", import.meta.url)));
  await assert.rejects(access(new URL("../db", import.meta.url)));

  // Oturum koruması ve gerçek API istemcisi yerinde olmalı.
  const session = await readFile(new URL("../lib/session.ts", import.meta.url), "utf8");
  assert.match(session, /httpOnly: true/);
  assert.match(session, /requireUser/);
});
