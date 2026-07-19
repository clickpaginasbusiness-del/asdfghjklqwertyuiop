import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Sparkles } from 'lucide-react'

export function DemoPlaceholderPage({
  titulo,
  icon: Icon,
  descricao,
}: {
  titulo: string
  icon: LucideIcon
  descricao: string
}) {
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold text-gray-900">{titulo}</h1>

      <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
          <Icon className="w-7 h-7 text-rose-400" />
        </div>
        <h2 className="font-serif text-xl font-semibold text-gray-900 mb-2">
          Essa área não faz parte da demonstração
        </h2>
        <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
          {descricao} Crie sua conta grátis para explorar o painel completo, sem limitações.
        </p>
        <Link
          href="/painel/cadastro"
          className="inline-flex items-center gap-2 bg-rose-400 text-white px-6 py-3 rounded-2xl font-semibold text-sm hover:bg-rose-500 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Criar minha conta grátis
        </Link>
      </div>
    </div>
  )
}
