"use client";

import { useEffect } from "react";

/**
 * Beklenmeyen hatalarda gösterilir. Teknik ayrıntı kullanıcıya
 * gösterilmez; yalnızca `digest` verilir ki destek kaydı eşleştirilebilsin.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[web] beklenmeyen hata:", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--cream)] px-5">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-black tracking-[-.055em] text-[var(--forest)]">
          Bir şeyler ters gitti.
        </h1>
        <p className="mt-4 leading-7 text-[var(--muted)]">
          Sorunu kaydettik. Tekrar denemek ister misin?
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            Destek kodu: <code className="font-mono">{error.digest}</code>
          </p>
        )}
        <button onClick={reset} className="brand-button mt-8 px-7 py-4">
          Tekrar dene
        </button>
      </div>
    </main>
  );
}
