import Link from 'next/link'
import { CalendarX2 } from 'lucide-react'

export default function AvaliarNotFound() {
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
        <span className="font-serif text-lg font-bold text-rose-400 mb-10">BelleBook</span>

        <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center mb-6">
          <CalendarX2 className="w-8 h-8 text-rose-400" />
        </div>

        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
          Este link de avaliação não está mais disponível
        </h1>
        <p className="text-gray-500 text-base leading-relaxed mb-10">
          Ele pode ter expirado ou já ter sido utilizado. Se você acredita que isso é um engano,
          entre em contato diretamente com a profissional que te atendeu.
        </p>

        <Link
          href="/"
          className="px-6 py-3 rounded-full text-sm font-semibold bg-rose-400 hover:bg-rose-500 text-white transition-colors shadow-[0_8px_30px_rgba(251,113,133,0.35)]"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  )
}
