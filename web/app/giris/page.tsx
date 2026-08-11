"use client";

import { ArrowLeft, ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Brand } from "../components/Brand";

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    window.setTimeout(() => router.push("/panel"), 650);
  }

  return <main className="grid min-h-screen bg-[var(--cream)] lg:grid-cols-[.92fr_1.08fr]">
    <section className="flex min-h-screen flex-col p-5 sm:p-8 lg:p-12">
      <div className="flex items-center justify-between"><Brand /><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Ana sayfa</Link></div>
      <div className="mx-auto my-auto w-full max-w-[460px] py-16"><span className="text-xs font-black uppercase tracking-[.15em] text-[var(--lime-dark)]">MyStore demo</span><h1 className="mt-3 text-4xl font-black tracking-[-.055em] text-[var(--forest)] sm:text-5xl">Tekrar hoş geldin.</h1><p className="mt-4 leading-7 text-[var(--muted)]">Paketlerini, siparişlerini ve hakedişlerini yönetmek için giriş yap.</p><form onSubmit={submit} className="mt-9 space-y-4"><label className="form-label">E-posta<div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} /><input required type="email" defaultValue="demo@modafirini.com" className="form-input pl-12" /></div></label><label className="form-label">Şifre<div className="relative"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} /><input required type="password" defaultValue="demo1234" className="form-input pl-12" /></div></label><div className="flex items-center justify-between text-xs"><label className="flex items-center gap-2 font-bold text-[var(--muted)]"><input type="checkbox" defaultChecked className="accent-[var(--forest)]" /> Beni hatırla</label><button type="button" className="font-black text-[var(--forest)]">Şifremi unuttum</button></div><button disabled={loading} className="brand-button w-full justify-center px-6 py-4">{loading ? "Demo açılıyor..." : "Giriş yap"}<ArrowRight size={18} /></button></form><p className="mt-6 flex items-center justify-center gap-2 text-xs text-[var(--muted)]"><ShieldCheck size={15} /> Dummy hesap — gerçek kimlik doğrulama yapılmaz.</p></div>
    </section>
    <section className="relative hidden overflow-hidden bg-[var(--forest)] p-12 text-white lg:flex lg:flex-col lg:justify-end"><img src="/images/bag-bakery.jpg" alt="Pastane tezgahındaki günlük ürünler" className="absolute inset-0 h-full w-full object-cover opacity-55" /><div className="absolute inset-0 bg-gradient-to-t from-[var(--forest)] via-[var(--forest)]/75 to-[var(--forest)]/20" /><div className="relative max-w-xl"><span className="rounded-full bg-[var(--lime)] px-4 py-2 text-xs font-black text-[var(--forest)]">BUGÜN 31 PAKET KURTARILDI</span><blockquote className="mt-7 text-4xl font-black leading-[1.08] tracking-[-.05em]">“Eskiden gün sonunda üzülerek ayırdığımız ürünler artık yeni müşterilerle buluşuyor.”</blockquote><p className="mt-6 text-white/60">— Moda Fırını, Kadıköy</p></div></section>
  </main>;
}

