import { ArrowUpRight, BriefcaseBusiness, Camera, Mail } from "lucide-react";
import Link from "next/link";
import { Brand } from "./Brand";

export function PublicFooter() {
  return (
    <footer className="bg-[#06281f] px-5 pb-8 pt-16 text-white lg:px-8 lg:pt-20">
      <div className="mx-auto grid max-w-[1240px] gap-12 border-b border-white/10 pb-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="inline-flex rounded-2xl bg-white px-3 py-2"><Brand compact /></div>
          <p className="mt-6 max-w-md text-lg leading-8 text-white/65">
            İyi yemek çöpe gitmesin. Mahallendeki sürpriz paketleri kurtar, bütçene ve gezegene iyi bak.
          </p>
          {/* Çalışmayan düğme bırakmak yerine gerçek bağlantılar; ekran
              okuyucu için her biri ayrı ayrı adlandırıldı. */}
          <div className="mt-7 flex gap-3">
            {[
              { Icon: Camera, label: "Instagram", href: "https://instagram.com/yepaket" },
              { Icon: BriefcaseBusiness, label: "LinkedIn", href: "https://linkedin.com/company/yepaket" },
              { Icon: Mail, label: "E-posta ile yaz", href: "mailto:merhaba@yepaket.app" },
            ].map(({ Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                rel="noopener noreferrer"
                target={href.startsWith("http") ? "_blank" : undefined}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/15 text-white/70 transition hover:border-[var(--lime)] hover:text-[var(--lime)]"
              >
                <Icon size={18} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-extrabold">YePaket</h3>
          <div className="mt-5 flex flex-col gap-3 text-sm text-white/60">
            <Link href="/#nasil-calisir">Nasıl çalışır?</Link>
            <Link href="/#etki">Etkimiz</Link>
            <Link href="/isletmeler">İşletmeler için</Link>
            <Link href="/destek">Yardım merkezi</Link>
          </div>
        </div>
        <div>
          <h3 className="font-extrabold">Yasal</h3>
          <div className="mt-5 flex flex-col gap-3 text-sm text-white/60">
            <Link href="/gizlilik">Gizlilik</Link>
            <Link href="/kosullar">Kullanım koşulları</Link>
            <Link href="/gizlilik#cerezler">Çerez tercihleri</Link>
            <a href="mailto:merhaba@yepaket.app" className="inline-flex items-center gap-1">Bize ulaş <ArrowUpRight size={14} /></a>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-2 pt-7 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 YePaket. Demo arayüz — veriler temsilidir.</span>
        <span>İstanbul’da sevgiyle tasarlandı.</span>
      </div>
    </footer>
  );
}
