import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#F7F4EA] px-6 text-center font-[var(--font-display)]">
      <p className="text-[34px] font-bold text-[#26231E]">404</p>
      <p className="font-mono text-[12.5px] text-[#55503F]">
        Página no encontrada · Page not found
      </p>
      <Link
        href="/"
        className="rounded-[3px] border-[1.5px] border-[#2E4E9E] bg-white px-5 py-2 text-[11px] font-bold uppercase tracking-[1.2px] text-[#2E4E9E]"
      >
        Inicio
      </Link>
    </main>
  );
}
