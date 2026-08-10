'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { formatDateShort } from '@/lib/utils'
import { Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

interface AssinaturaPlano {
  id: string
  status: 'ativa' | 'cancelada' | 'suspensa'
  creditos_restantes: number
  creditos_totais: number
  periodo_fim: string | null
  plano: { nome: string; preco: number; intervalo: string } | null
}

interface Props {
  open: boolean
  onClose: () => void
  prestadoraId: string
  corTema: string
}

/** Modal "Meus planos" no dropdown de perfil da cliente — mesma UI nas 3
 * variantes de página pública. Só mostra assinaturas ativas com essa
 * prestadora (cancelar aqui é o mesmo endpoint usado pela prestadora em
 * Relatórios > Planos, só que autenticado por token de cliente). */
export function MeusPlanosModal({ open, onClose, prestadoraId, corTema }: Props) {
  const [assinaturas, setAssinaturas] = useState<AssinaturaPlano[]>([])
  const [carregando, setCarregando] = useState(false)
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const token = localStorage.getItem('clienteToken')
    if (!token) return
    setCarregando(true)
    fetch('/api/planos/meus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, prestadoraId }),
    })
      .then((r) => (r.ok ? r.json() : { assinaturas: [] }))
      .then((data: { assinaturas: AssinaturaPlano[] }) => {
        setAssinaturas((data.assinaturas ?? []).filter((a) => a.status === 'ativa'))
      })
      .finally(() => setCarregando(false))
  }, [open, prestadoraId])

  async function cancelar(id: string) {
    const token = localStorage.getItem('clienteToken')
    setCancelandoId(id)
    try {
      const res = await fetch(`/api/planos/assinaturas/${id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) { toast.error('Erro ao cancelar assinatura'); return }
      setAssinaturas((prev) => prev.filter((a) => a.id !== id))
      toast.success('Assinatura cancelada')
    } finally {
      setCancelandoId(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Meus planos">
      <div className="p-6 space-y-3">
        {carregando ? (
          <p className="text-sm text-gray-400 text-center py-6">Carregando...</p>
        ) : assinaturas.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Você não tem nenhum plano ativo com essa prestadora.</p>
        ) : (
          assinaturas.map((a) => (
            <div key={a.id} className="rounded-xl border border-gray-100 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: corTema }}>
                <Sparkles className="w-3.5 h-3.5" />
                {a.plano?.nome ?? 'Plano'}
              </div>
              <p className="text-xs text-gray-500">
                {a.creditos_restantes}/{a.creditos_totais} créditos restantes
                {a.periodo_fim && ` · Renova em ${formatDateShort(a.periodo_fim)}`}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelar(a.id)}
                loading={cancelandoId === a.id}
                className="w-full"
              >
                Cancelar assinatura
              </Button>
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}
