import { useEffect, useState } from 'react'

export interface AssinaturaComCredito {
  id: string
  creditosRestantes: number
  planoNome: string
  descontoTipo: 'percentual' | 'fixo'
  descontoValor: number
}

/** Espelha calcularValorComDesconto de src/lib/planosPrestadora.ts — duplicado
 * aqui (em vez de importado) porque esse arquivo roda no bundle do cliente e
 * planosPrestadora.ts é código de servidor. Só usado pra pré-visualizar o
 * valor com desconto antes de confirmar; o valor cobrado de verdade é
 * recalculado no servidor em /api/agendamentos/pagar. */
export function calcularValorComDesconto(valor: number, descontoTipo: 'percentual' | 'fixo', descontoValor: number): number {
  if (!descontoValor) return valor
  const final = descontoTipo === 'percentual' ? valor * (1 - descontoValor / 100) : valor - descontoValor
  return Math.max(0, Math.round(final * 100) / 100)
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
