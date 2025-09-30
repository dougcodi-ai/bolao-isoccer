import Link from "next/link";
import { Trophy, Target, Shield, CheckCircle2, XCircle, ArrowLeft, ArrowRight, ListOrdered, Info } from "lucide-react";

export default function RegrasPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-14 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="btn-ghost inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Início
            </Link>
            <h1 className="text-xl md:text-2xl font-extrabold">Regras do Bolão</h1>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link className="btn-ghost" href="/palpites">Dashboard</Link>
            <Link className="btn-ghost" href="/ranking">Ranking</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8 md:py-12">
        <div className="text-center mb-10">
          <h2 className="heading text-3xl md:text-4xl font-bold mb-3">Pontuação</h2>
          <p className="text-muted text-lg max-w-2xl mx-auto">Como os pontos são calculados para cada palpite de jogo realizado</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="card p-5 border-green-200 bg-green-50">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-green-700" />
              <h3 className="text-lg font-bold text-green-900">Exato</h3>
            </div>
            <p className="text-sm text-green-800 mb-3">Acertou exatamente o placar do jogo.</p>
            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-green-600 text-white">+10 pontos</span>
          </div>

          <div className="card p-5 border-sky-200 bg-sky-50">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-sky-700" />
              <h3 className="text-lg font-bold text-sky-900">Resultado</h3>
            </div>
            <p className="text-sm text-sky-800 mb-3">Acertou o vencedor (ou empate), mas não o placar exato.</p>
            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-sky-600 text-white">+5 pontos</span>
          </div>

          <div className="card p-5 border-yellow-200 bg-yellow-50">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-yellow-700" />
              <h3 className="text-lg font-bold text-yellow-900">Parcial</h3>
            </div>
            <p className="text-sm text-yellow-800 mb-3">Acertou os gols de um dos times (sem ser exato ou apenas tendência).</p>
            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-yellow-500 text-white">+3 pontos</span>
          </div>

          <div className="card p-5 border-neutral-200 bg-neutral-50">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-5 w-5 text-neutral-700" />
              <h3 className="text-lg font-bold text-neutral-900">Errou</h3>
            </div>
            <p className="text-sm text-neutral-700 mb-3">Não acertou o placar, tendência ou parcial.</p>
            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-neutral-400 text-white">0 pontos</span>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Info className="h-5 w-5" /> Exemplos rápidos
            </h3>
            <ul className="text-muted list-disc ml-5 space-y-2 text-sm">
              <li>Palpite 2x1, jogo 2x1: Exato (+10)</li>
              <li>Palpite 1x0, jogo 3x1: Acertou vencedor (+5)</li>
              <li>Palpite 0x0, jogo 1x1: Acertou empate (+5)</li>
              <li>Palpite 2x1, jogo 2x0: Acertou gols do mandante (+3)</li>
              <li>Sem palpite: 0</li>
            </ul>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><ListOrdered className="h-5 w-5" /> Desempate no Ranking</h3>
            <ol className="text-muted list-decimal ml-5 space-y-2 text-sm">
              <li>Pontos totais</li>
              <li>Número de placares exatos</li>
              <li>Número de acertos de resultado</li>
              <li>Número de acertos parciais</li>
              <li>Número de palpites efetuados</li>
            </ol>
            <p className="text-xs text-gray-500 mt-3">Em caso de novo empate absoluto, há sorteio determinístico para manter a ordem estável.</p>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/" className="btn-ghost inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar à landing
          </Link>
          <Link href="/ranking" className="btn-primary inline-flex items-center gap-2">
            Ver ranking
            <Trophy className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}