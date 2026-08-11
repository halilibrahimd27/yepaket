import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="YePaket ana sayfa">
      <img
        src="/images/yep-logo.png"
        alt="YEP logo"
        className={`${compact ? "h-9 w-9" : "h-11 w-11"} rounded-[14px] object-cover shadow-sm`}
      />
      <span className="text-xl font-black tracking-[-0.04em] text-[var(--forest)]">
        Ye<span className="text-[var(--lime-dark)]">Paket</span>
      </span>
    </Link>
  );
}

