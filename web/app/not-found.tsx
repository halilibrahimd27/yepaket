import Link from "next/link";
import { PublicFooter } from "./components/PublicFooter";
import { PublicHeader } from "./components/PublicHeader";

export const metadata = { title: "Sayfa bulunamadı — YePaket" };

export default function NotFound() {
  return (
    <div className="bg-[var(--cream)]">
      <PublicHeader />
      <main className="grid min-h-[70vh] place-items-center px-5 pt-32">
        <div className="max-w-md text-center">
          <span className="text-xs font-black uppercase tracking-[.16em] text-[var(--lime-dark)]">
            404
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-[-.055em] text-[var(--forest)] sm:text-5xl">
            Bu paket kapılmış.
          </h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">
            Aradığın sayfa taşınmış veya hiç var olmamış olabilir.
          </p>
          <Link href="/" className="brand-button mt-8 inline-flex px-7 py-4">
            Ana sayfaya dön
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
