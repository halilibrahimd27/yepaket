"use client";

import { BookOpen, Check, ChevronDown, Mail, MessageCircle, Search, ShieldCheck, ShoppingBag, Store } from "lucide-react";
import { FormEvent, useState } from "react";
import { faqItems } from "../data";
import { PublicFooter } from "../components/PublicFooter";
import { PublicHeader } from "../components/PublicHeader";

const topics = [
  { icon: ShoppingBag, title: "Sipariş & teslim", text: "Rezervasyon, teslim saati, iptal ve iade" },
  { icon: ShieldCheck, title: "Hesap & ödeme", text: "Giriş, ödeme yöntemleri ve güvenlik" },
  { icon: Store, title: "İşletme desteği", text: "Paket, sipariş, panel ve hakediş" },
  { icon: BookOpen, title: "YePaket rehberi", text: "Sürpriz paketler hakkında temel bilgiler" },
];

export default function Support() {
  const [open, setOpen] = useState(0);
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSending(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "support-ticket",
          payload: {
            name: String(form.get("name") ?? ""),
            email: String(form.get("email") ?? ""),
            subject: String(form.get("subject") ?? "Destek talebi"),
            message: String(form.get("message") ?? ""),
            category: String(form.get("category") ?? "other"),
          },
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(body.error?.message ?? "Talep gönderilemedi.");
        return;
      }

      setSent(true);
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setSending(false);
    }
  }

  // Arama kutusu eskiden hiçbir state'e bağlı değildi ve yazmak SSS
  // listesini etkilemiyordu.
  const needle = query.trim().toLocaleLowerCase("tr-TR");
  const visibleFaqs = needle
    ? faqItems.filter(
        (item) =>
          item.question.toLocaleLowerCase("tr-TR").includes(needle) ||
          item.answer.toLocaleLowerCase("tr-TR").includes(needle),
      )
    : faqItems;

  return <div className="bg-[var(--cream)]"><PublicHeader /><main>
    <section className="bg-[var(--forest)] px-5 pb-24 pt-36 text-white lg:px-8 lg:pb-28 lg:pt-44"><div className="mx-auto max-w-[900px] text-center"><span className="text-xs font-black uppercase tracking-[.16em] text-[var(--lime)]">Yardım merkezi</span><h1 className="mt-4 text-5xl font-black tracking-[-.06em] sm:text-7xl">Nasıl yardımcı olabiliriz?</h1><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/60">Sipariş, hesap veya işletme paneliyle ilgili hızlı yanıtlara ulaş.</p><div className="mx-auto mt-9 flex max-w-xl items-center gap-3 rounded-full bg-white px-5 py-4 text-[var(--ink)] shadow-2xl"><Search size={20} className="text-[var(--muted)]" /><input aria-label="Yardımda ara" value={query} onChange={(event) => { setQuery(event.target.value); setOpen(-1); }} placeholder="Örn. siparişimi nasıl teslim alırım?" className="w-full bg-transparent outline-none" /></div></div></section>
    <section className="px-5 py-20 lg:px-8 lg:py-24"><div className="mx-auto max-w-[1100px]"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{topics.map(({ icon: Icon, title, text }) => <button key={title} className="rounded-[26px] border border-black/5 bg-white p-6 text-left transition hover:-translate-y-1 hover:shadow-xl"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--lime-soft)] text-[var(--forest)]"><Icon size={21} /></div><h2 className="mt-5 font-black text-[var(--forest)]">{title}</h2><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{text}</p></button>)}</div><div className="mt-20 grid gap-12 lg:grid-cols-[.9fr_1.1fr]"><div><span className="text-xs font-black uppercase tracking-[.14em] text-[var(--lime-dark)]">Sık sorulanlar</span><h2 className="mt-4 text-4xl font-black tracking-[-.055em] text-[var(--forest)]">Aradığın cevap<br />burada olabilir.</h2></div><div className="space-y-3">{visibleFaqs.length === 0 ? <p className="rounded-[22px] border border-black/5 bg-white px-6 py-8 text-center leading-7 text-[var(--muted)]">&ldquo;{query}&rdquo; için sonuç bulunamadı. Aşağıdaki formdan bize yazabilirsin.</p> : visibleFaqs.map((item, index) => <div key={item.question} className="overflow-hidden rounded-[22px] border border-black/5 bg-white"><button onClick={() => setOpen(open === index ? -1 : index)} className="flex w-full items-center justify-between gap-5 px-6 py-5 text-left font-black text-[var(--forest)]">{item.question}<ChevronDown size={18} className={`shrink-0 transition ${open === index ? "rotate-180" : ""}`} /></button>{open === index && <p className="px-6 pb-6 leading-7 text-[var(--muted)]">{item.answer}</p>}</div>)}</div></div></div></section>
    <section className="bg-white px-5 py-20 lg:px-8 lg:py-24"><div className="mx-auto grid max-w-[1000px] gap-12 lg:grid-cols-[.8fr_1.2fr]"><div><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--forest)] text-[var(--lime)]"><MessageCircle size={24} /></div><h2 className="mt-6 text-4xl font-black tracking-[-.055em] text-[var(--forest)]">Hâlâ yardıma mı ihtiyacın var?</h2><p className="mt-4 leading-7 text-[var(--muted)]">Formu doldur, ekibimiz en kısa sürede dönüş yapsın.</p><a href="mailto:destek@yepaket.app" className="mt-6 inline-flex items-center gap-2 font-black text-[var(--forest)]"><Mail size={18} /> destek@yepaket.app</a></div><div className="rounded-[30px] bg-[var(--cream)] p-6 sm:p-8">{sent ? <div className="grid min-h-80 place-items-center text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--lime)] text-[var(--forest)]"><Check size={28} /></div><h3 className="mt-5 text-2xl font-black text-[var(--forest)]">Talebin alındı!</h3><p className="mt-2 text-sm text-[var(--muted)]">Talebini aldık; e-posta adresine bilgilendirme gönderdik.</p></div></div> : <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><label className="form-label">Ad soyad<input required name="name" className="form-input" /></label><label className="form-label">E-posta<input required name="email" type="email" className="form-input" /></label><label className="form-label sm:col-span-2">Konu<select name="category" className="form-input"><option value="order">Siparişim</option><option value="account">Hesabım</option><option value="payment">Ödeme / İade</option><option value="partner">İşletme paneli</option><option value="other">Diğer</option></select></label><label className="form-label sm:col-span-2">Mesaj<textarea required name="message" minLength={10} className="form-input min-h-32 resize-none" placeholder="Sorununu detaylıca anlat..." /></label>
<input type="hidden" name="subject" value="Web destek formu" />{error && <div role="alert" className="rounded-2xl border border-[#e65d4f]/25 bg-[#e65d4f]/8 px-4 py-3 text-sm font-semibold text-[#b23b2f] sm:col-span-2">{error}</div>}<button disabled={sending} className="brand-button justify-center px-6 py-4 disabled:opacity-60 sm:col-span-2">{sending ? "Gönderiliyor..." : "Talebi gönder"}</button></form>}</div></div></section>
  </main><PublicFooter /></div>;
}

