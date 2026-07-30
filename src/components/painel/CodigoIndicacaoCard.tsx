'use client'

import { Copy } from 'lucide-react'
import toast from 'react-hot-toast'

export function CodigoIndicacaoCard({ codigoIndicacao }: { codigoIndicacao: string | null }) {
  // NEXT_PUBLIC_APP_URL (não window.location.origin) — precisa ser o mesmo
  // valor no servidor e no cliente, senão o hydrate quebra: window só existe
  // no cliente, então o servidor sempre renderiza um fallback diferente do
  // que o cliente calcula na primeira renderização.
  const linkIndicacao = `${process.env.NEXT_PUBLIC_APP_URL}/painel/cadastro?ref=${codigoIndicacao ?? ''}`

  if (!codigoIndicacao) {
    return (
      <p className="text-sm text-gray-400">
        Seu código de indicação será gerado automaticamente. Recarregue a página.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1.5">Seu código</label>
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
          <span className="font-mono font-bold text-gray-900 tracking-widest text-lg flex-1">
            {codigoIndicacao}
          </span>
          <button
            onClick={() => { navigator.clipboard.writeText(codigoIndicacao); toast.success('Código copiado!') }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1.5">Link de indicação</label>
        <div className="flex items-center gap-3 bg-rose-50 rounded-xl px-4 py-3">
          <span className="text-sm text-rose-700 flex-1 truncate">{linkIndicacao}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(linkIndicacao); toast.success('Link copiado!') }}
            className="text-rose-400 hover:text-rose-600 transition-colors shrink-0"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
