"use client";

import Protected from "@/components/Protected";

export default function TestProtected() {
  return (
    <Protected>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="p-8">
          <h1>Teste do componente Protected</h1>
          <p>Se você está vendo isso, o componente Protected está funcionando.</p>
        </div>
      </div>
    </Protected>
  );
}