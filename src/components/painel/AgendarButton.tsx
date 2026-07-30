'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgendarManualModal } from './AgendarManualModal'
import type { Agendamento } from '@/lib/types'

export function AgendarButton({
  prestadoraId, className, onCriado,
}: {
  prestadoraId: string
  className?: string
  onCriado?: (agendamento: Agendamento) => void
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className={className}>
        <Plus className="w-4 h-4" />
        Agendar
      </Button>
      {/* Só monta o modal quando aberto — cada abertura é uma instância nova,
          com estado limpo, sem precisar resetar campo por campo num effect. */}
      {open && (
        <AgendarManualModal
          onClose={() => setOpen(false)}
          prestadoraId={prestadoraId}
          onCriado={(agendamento) => {
            setOpen(false)
            onCriado?.(agendamento)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
