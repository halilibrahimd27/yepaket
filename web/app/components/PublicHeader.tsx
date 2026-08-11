"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Brand } from "./Brand";

const links = [
  { href: "/#paketler", label: "Paketler" },
  { href: "/#nasil-calisir", label: "Nasıl çalışır?" },
  { href: "/#etki", label: "Etkimiz" },
  { href: "/isletmeler", label: "İşletmeler için" },
  { href: "/destek", label: "Destek" },
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-[rgba(247,245,236,.88)] backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
        <Brand compact />
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Ana menü">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link text-sm font-semibold text-[var(--muted)]">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/giris" className="rounded-full px-4 py-2.5 text-sm font-bold text-[var(--forest)] hover:bg-white/80">
            İşletme girişi
          </Link>
          <Link href="/#uygulama" className="brand-button px-5 py-3 text-sm">
            Uygulamayı indir
          </Link>
        </div>
        <button
          className="grid h-11 w-11 place-items-center rounded-full bg-white text-[var(--forest)] shadow-sm lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-black/5 bg-[var(--cream)] px-5 py-5 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobil menü">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 font-bold text-[var(--forest)] hover:bg-white"
              >
                {link.label}
              </Link>
            ))}
            <Link href="/giris" onClick={() => setOpen(false)} className="mt-2 rounded-2xl bg-[var(--forest)] px-4 py-3 text-center font-bold text-white">
              İşletme girişi
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

