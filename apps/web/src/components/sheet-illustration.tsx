/** Ilustración de cabecera (mundo talonario): hoja original → flecha → copia de datos. */
export function SheetIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 268 118" fill="none" className={className} aria-hidden="true">
      {/* Hoja original */}
      <rect x="10" y="8" width="118" height="102" rx="4" className="fill-sheet stroke-rule" strokeWidth="1.5" />
      <rect x="22" y="22" width="60" height="8" rx="2" className="fill-[color:var(--accent)] opacity-70" />
      <rect x="22" y="38" width="94" height="3" rx="1.5" className="fill-rule-soft" />
      <rect x="22" y="48" width="94" height="3" rx="1.5" className="fill-rule-soft" />
      <rect x="22" y="58" width="94" height="3" rx="1.5" className="fill-rule-soft" />
      <rect x="22" y="68" width="70" height="3" rx="1.5" className="fill-rule-soft" />
      <rect x="22" y="84" width="42" height="14" rx="2" className="stroke-rule-soft" strokeWidth="1.2" />
      {/* Sello de verificación en la hoja */}
      <circle cx="106" cy="88" r="13" className="stroke-accent" strokeWidth="2" />
      <path d="M100 88l4.5 4.5L109 80" className="stroke-accent" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Flecha */}
      <path d="M146 60h30m0 0l-9-9m9 9l-9 9" className="stroke-accent" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Copia de datos (carbón) */}
      <rect x="196" y="16" width="52" height="86" rx="3" className="fill-carbon" />
      <rect x="204" y="28" width="26" height="5" rx="2" className="fill-[color:var(--carbon-key)]" />
      <rect x="204" y="42" width="36" height="3" rx="1.5" className="fill-[color:var(--carbon-text)]" />
      <rect x="204" y="51" width="36" height="3" rx="1.5" className="fill-[color:var(--carbon-text)]" />
      <rect x="204" y="60" width="28" height="3" rx="1.5" className="fill-[color:var(--carbon-soft)]" />
      <rect x="204" y="69" width="36" height="3" rx="1.5" className="fill-[color:var(--carbon-text)]" />
      <rect x="204" y="84" width="20" height="8" rx="2" className="fill-[color:var(--carbon-number)]" />
    </svg>
  );
}
