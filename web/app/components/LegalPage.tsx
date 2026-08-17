import { ReactNode } from "react";
import { PublicFooter } from "./PublicFooter";
import { PublicHeader } from "./PublicHeader";

/**
 * Yasal metin sayfalarının ortak çerçevesi.
 *
 * Uzun metinlerde okunabilirlik satır uzunluğuna bağlıdır: `max-w-[72ch]`
 * satırı yaklaşık 72 karakterde tutar. Tam genişlikte akan bir metinde göz
 * satır sonundan satır başına dönerken kaybolur.
 */
export function LegalPage({
  title,
  updatedAt,
  intro,
  children,
}: {
  title: string;
  updatedAt: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      <main className="bg-[var(--cream)] px-5 pb-24 pt-[120px] lg:px-8">
        <article className="mx-auto max-w-[72ch]">
          <h1 className="text-3xl font-extrabold leading-tight text-[var(--forest)] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-black/50">
            Son güncelleme: {updatedAt}
          </p>

          {intro ? (
            <p className="mt-8 text-lg leading-8 text-black/70">{intro}</p>
          ) : null}

          <div className="legal-body mt-10">{children}</div>
        </article>
      </main>
      <PublicFooter />
    </>
  );
}

/** Numaralandırılmış bölüm başlığı ve gövdesi. */
export function LegalSection({
  id,
  number,
  title,
  children,
}: {
  id?: string;
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    // `scroll-mt` sabit başlığın altında kalmayı önler: #cerezler gibi bir
    // bağlantıya tıklandığında başlık header'ın arkasında kaybolmasın.
    <section id={id} className="mt-12 scroll-mt-[100px]">
      <h2 className="text-xl font-extrabold text-[var(--forest)]">
        {number}. {title}
      </h2>
      <div className="mt-4 space-y-4 leading-7 text-black/70">{children}</div>
    </section>
  );
}
