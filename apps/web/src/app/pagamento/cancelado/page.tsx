"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function PaymentCanceledPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-xl px-6 py-16 text-center"><p>Carregando...</p></main>}>
      <PaymentCanceledPageInner />
    </Suspense>
  );
}

function PaymentCanceledPageInner() {
  const search = useSearchParams();
  const sessionId = search.get("session_id");
  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-3xl font-extrabold mb-4">Pagamento cancelado</h1>
      <p className="text-slate-300 mb-8">Seu pagamento não foi concluído. Você pode tentar novamente quando quiser.</p>
      <div className="space-x-3">
        <Link href="/bolao/criar" className="btn-primary">Tentar novamente</Link>
        <Link href="/" className="btn-ghost">Voltar ao início</Link>
      </div>
    </main>
  );
}