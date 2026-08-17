"use client";

import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  Mail,
  MailCheck,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Brand } from "./Brand";

/** Sunucudaki kuralın aynısı: en az 8 karakter, bir harf ve bir rakam. */
const PASSWORD_PATTERN = /^(?=.*[a-zA-ZğüşöçıİĞÜŞÖÇ])(?=.*\d).{8,}$/;

async function post(body: unknown): Promise<{ ok: boolean; message?: string }> {
  const response = await fetch("/api/auth/password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.ok) return { ok: true };

  const payload = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  };

  if (payload.error?.code === "RATE_LIMITED") {
    return {
      ok: false,
      message: "Çok fazla deneme yapıldı. Bir dakika sonra tekrar deneyin.",
    };
  }

  return { ok: false, message: payload.error?.message ?? "İşlem tamamlanamadı." };
}

/** Ortak kabuk: iki formun da aynı görsel çerçeveyi paylaşması için. */
function Shell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--cream)] px-5 py-16">
      <div className="w-full max-w-[460px]">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] hover:text-[var(--forest)]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Ana sayfaya dön
        </Link>

        <div className="rounded-[28px] bg-white p-8 shadow-[0_20px_60px_-30px_rgba(11,59,46,.35)]">
          <Brand />
          <h1 className="mt-7 text-2xl font-extrabold text-[var(--forest)]">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
          {children}
        </div>
      </div>
    </main>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-5 flex items-start gap-2 rounded-2xl bg-[#FDECEC] p-3 text-xs font-bold text-[#B4231F]"
    >
      <TriangleAlert size={15} aria-hidden="true" className="mt-px shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// -----------------------------------------------------------------------------

/** Adım 1: sıfırlama bağlantısı iste. */
export function RequestResetForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    const result = await post({ action: "request", email });

    setLoading(false);
    if (result.ok) setSentTo(email);
    else setError(result.message ?? "İşlem tamamlanamadı.");
  }

  if (sentTo) {
    return (
      <Shell
        title="Posta kutunu kontrol et"
        description={`${sentTo} adresi kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Bağlantı 30 dakika geçerli.`}
      >
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[var(--lime-soft)] p-4">
          <MailCheck size={20} aria-hidden="true" className="text-[var(--forest)]" />
          <p className="text-xs leading-5 text-[var(--forest)]">
            E-posta birkaç dakika içinde gelmezse gereksiz (spam) klasörüne
            bakmayı unutma.
          </p>
        </div>

        <Link
          href="/giris"
          className="brand-button mt-6 w-full justify-center px-6 py-4"
        >
          Girişe dön
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </Shell>
    );
  }

  return (
    <Shell
      title="Şifreni sıfırla"
      description="Hesabına bağlı e-posta adresini yaz; şifreni yenilemen için bir bağlantı gönderelim."
    >
      <form onSubmit={submit} className="mt-7 grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs font-black text-[var(--forest)]">E-posta</span>
          <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[var(--cream)] px-4">
            <Mail size={16} aria-hidden="true" className="text-[var(--muted)]" />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="ornek@isletmeniz.com"
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
        </label>

        {error ? <ErrorBox message={error} /> : null}

        <button
          disabled={loading}
          className="brand-button w-full justify-center px-6 py-4 disabled:opacity-70"
        >
          {loading ? "Gönderiliyor..." : "Bağlantı gönder"}
          <ArrowRight size={18} aria-hidden="true" />
        </button>

        <Link
          href="/giris"
          className="text-center text-xs font-black text-[var(--forest)] hover:underline"
        >
          Girişe dön
        </Link>
      </form>
    </Shell>
  );
}

// -----------------------------------------------------------------------------

/** Adım 2: e-postadaki jetonla yeni şifreyi belirle. */
export function ConfirmResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <Shell
        title="Bağlantı geçersiz"
        description="Sıfırlama bağlantısı eksik veya bozuk görünüyor. Yeni bir bağlantı isteyebilirsin."
      >
        <Link
          href="/sifremi-unuttum"
          className="brand-button mt-6 w-full justify-center px-6 py-4"
        >
          Yeni bağlantı iste
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </Shell>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    // Sunucu da doğruluyor; burada kesmek kullanıcıyı gereksiz bir ağ
    // turundan ve belirsiz bir hatadan kurtarır.
    if (!PASSWORD_PATTERN.test(password)) {
      setError("Şifre en az 8 karakter olmalı ve bir harf ile bir rakam içermeli.");
      return;
    }

    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    const result = await post({ action: "confirm", token, newPassword: password });
    setLoading(false);

    if (result.ok) {
      setDone(true);
      // Kullanıcı mesajı okuyabilsin diye kısa bir gecikme.
      setTimeout(() => router.push("/giris"), 2500);
    } else {
      setError(result.message ?? "İşlem tamamlanamadı.");
    }
  }

  if (done) {
    return (
      <Shell
        title="Şifren güncellendi"
        description="Tüm cihazlardaki oturumların kapatıldı. Yeni şifrenle giriş yapabilirsin."
      >
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[var(--lime-soft)] p-4">
          <ShieldCheck size={20} aria-hidden="true" className="text-[var(--forest)]" />
          <p className="text-xs leading-5 text-[var(--forest)]">
            Giriş sayfasına yönlendiriliyorsun...
          </p>
        </div>

        <Link href="/giris" className="brand-button mt-6 w-full justify-center px-6 py-4">
          Girişe git
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </Shell>
    );
  }

  return (
    <Shell
      title="Yeni şifreni belirle"
      description="Şifreni değiştirdiğinde tüm cihazlardaki oturumların kapatılır."
    >
      <form onSubmit={submit} className="mt-7 grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs font-black text-[var(--forest)]">Yeni şifre</span>
          <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[var(--cream)] px-4">
            <LockKeyhole size={16} aria-hidden="true" className="text-[var(--muted)]" />
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="En az 8 karakter, bir harf ve bir rakam"
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-black text-[var(--forest)]">Şifreyi tekrar gir</span>
          <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[var(--cream)] px-4">
            <LockKeyhole size={16} aria-hidden="true" className="text-[var(--muted)]" />
            <input
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
        </label>

        {error ? <ErrorBox message={error} /> : null}

        <button
          disabled={loading}
          className="brand-button w-full justify-center px-6 py-4 disabled:opacity-70"
        >
          {loading ? "Güncelleniyor..." : "Şifreyi güncelle"}
          <ArrowRight size={18} aria-hidden="true" />
        </button>

        <Link
          href="/giris"
          className="text-center text-xs font-black text-[var(--forest)] hover:underline"
        >
          Vazgeç
        </Link>
      </form>
    </Shell>
  );
}
