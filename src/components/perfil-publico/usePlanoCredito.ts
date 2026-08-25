import { useEffect, useState } from 'react'

export interface AssinaturaComCredito {
  id: string
  creditosRestantes: number
  planoNome: string
  descontoTipo: 'percentual' | 'fixo'
  descontoValor: number
}

/** Checa (via /api/planos/verificar-credito) se a cliente logada tem uma
 * assinatura com crédito pro serviço selecionado, pra exibir o badge de
 * plano no passo de confirmação do agendamento. A checkbox "usar crédito"
 * começa marcada por padrão, conforme o fluxo descrito pela prestadora. */
export function usePlanoCredito({
  clienteLogado, prestadoraId, servicoId,
}: {
  clienteLogado: { id: string } | null
  prestadoraId: string
  servicoId: string | null
}) {
  const [assinatura, setAssinatura] = useState<AssinaturaComCredito | null>(null)
  const [usarCredito, setUsarCredito] = useState(true)

  useEffect(() => {
    setAssinatura(null)
    if (!clienteLogado || !servicoId) return
    const token = localStorage.getItem('clienteToken')
    if (!token) return

    let cancelado = false
    fetch('/api/planos/verificar-credito', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, prestadoraId, servicoId }),
    })
      .then((r) => (r.ok ? r.json() : { assinatura: null }))
      .then((data: { assinatura: AssinaturaComCredito | null }) => {
        if (cancelado) return
        setAssinatura(data.assinatura)
        setUsarCredito(true)
      })
      .catch(() => {})

    return () => { cancelado = true }
  }, [clienteLogado, prestadoraId, servicoId])

  return { assinatura, usarCredito, setUsarCredito }
}
