"use client";

import { ArrowLeft, ArrowRight, LockKeyhole, Mail, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Brand } from "./Brand";

/** Hata koduna göre kullanıcıya gösterilecek mesaj. */
function messageFor(code: string, fallback: string): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "E-posta veya şifre hatalı.";
    case "RATE_LIMITED":
      return "Çok fazla deneme yapıldı. Lütfen bir dakika sonra tekrar deneyin.";
    case "ACCOUNT_DISABLED":
      return "Bu hesap kapatılmış.";
    default:
      return fallback;
  }
}

export function LoginForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        }),
      });

      const payload = (await response.json()) as {
        error?: { code: string; message: string };
      };

      if (!response.ok) {
        setError(messageFor(payload.error?.code ?? "", payload.error?.message ?? "Giriş yapılamadı."));
        return;
      }

      // Sunucu bileşenlerinin yeni oturumla yeniden çalışması için
      // yönlendirme sonrası yenileme gerekiyor.
      router.replace(returnTo);
      router.refresh();
    } catch {
      setError("Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[var(--cream)] lg:grid-cols-[.92fr_1.08fr]">
      <section className="flex min-h-screen flex-col p-5 sm:p-8 lg:p-12">
        <div className="flex items-center justify-between">
          <Brand />
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] hover:text-[var(--forest)]"
          >
            <ArrowLeft size={17} /> Ana sayfa
          </Link>
        </div>

        <div className="mx-auto my-auto w-full max-w-[460px] py-16">
          <span className="text-xs font-black uppercase tracking-[.15em] text-[var(--lime-dark)]">
            MyStore
          </span>
          <h1 className="mt-3 text-4xl font-black tracking-[-.055em] text-[var(--forest)] sm:text-5xl">
            Tekrar hoş geldin.
          </h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">
            Paketlerini, siparişlerini ve hakedişlerini yönetmek için giriş yap.
          </p>

          <form onSubmit={submit} className="mt-9 space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-[#e65d4f]/25 bg-[#e65d4f]/8 px-4 py-3 text-sm font-semibold text-[#b23b2f]"
              >
                <TriangleAlert size={18} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <label className="form-label">
              E-posta
              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                  size={18}
                  aria-hidden="true"
                />
                <input
                  required
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue="demo@modafirini.com"
                  className="form-input pl-12"
                />
              </div>
            </label>

            <label className="form-label">
              Şifre
              <div className="relative">
                <LockKeyhole
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                  size={18}
                  aria-hidden="true"
                />
                <input
                  required
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  defaultValue="demo1234"
                  className="form-input pl-12"
                />
              </div>
            </label>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 font-bold text-[var(--muted)]">
                <input type="checkbox" name="remember" defaultChecked className="accent-[var(--forest)]" />
                Beni hatırla
              </label>
              <Link href="/destek?konu=hesap" className="font-black text-[var(--forest)] hover:underline">
                Şifremi unuttum
              </Link>
            </div>

            <button disabled={loading} className="brand-button w-full justify-center px-6 py-4 disabled:opacity-70">
              {loading ? "Giriş yapılıyor..." : "Giriş yap"}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-[var(--muted)]">
            <ShieldCheck size={15} aria-hidden="true" /> Oturum bilgin tarayıcıya değil, güvenli
            çereze yazılır.
          </p>
        </div>
      </section>

      <section className="relative hidden overflow-hidden bg-[var(--forest)] p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <img
          src="/images/bag-bakery.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--forest)] via-[var(--forest)]/75 to-[var(--forest)]/20" />
        <div className="relative max-w-xl">
          <span className="rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-black text-[var(--forest)]">
            İYİ YEMEK ÇÖPE GİTMESİN
          </span>
          <blockquote className="mt-7 text-4xl font-black leading-[1.08] tracking-[-.05em]">
            “Eskiden gün sonunda üzülerek ayırdığımız ürünler artık yeni müşterilerle buluşuyor.”
          </blockquote>
          <p className="mt-6 text-white/60">— Moda Fırını, Kadıköy</p>
        </div>
      </section>
    </main>
  );
}
