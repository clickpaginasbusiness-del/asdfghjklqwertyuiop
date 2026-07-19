import Link from 'next/link'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-24 bg-[#fdf5f8] overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-rose-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-rose-300/30 blur-3xl"
      />

      <div className="relative z-[1] flex flex-col items-center text-center max-w-md">
        <Link href="/" className="font-serif text-lg font-bold text-rose-400 mb-10">
          BelleBook
        </Link>

        <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center mb-6">
          <Compass className="w-8 h-8 text-rose-400" />
        </div>

        <p className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-3">
          Erro 404
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          Página não encontrada
        </h1>
        <p className="text-gray-500 text-base leading-relaxed mb-10">
          O endereço que você tentou acessar não existe ou foi movido. Vamos te levar de volta
          para um lugar conhecido.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-3 rounded-full text-sm font-semibold bg-rose-400 hover:bg-rose-500 text-white transition-colors shadow-[0_8px_30px_rgba(251,113,133,0.35)]"
          >
            Voltar para o início
          </Link>
          <Link
            href="/painel"
            className="w-full sm:w-auto px-6 py-3 rounded-full text-sm font-semibold bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 transition-colors"
          >
            Ir para o painel
          </Link>
        </div>
      </div>
    </div>
  )
}
