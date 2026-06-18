'use client'

import { useState } from 'react'

export type CupomStatus = 'idle' | 'loading' | 'ok' | 'erro'

export interface CupomDesconto {
  percentOff: number | null
  amountOff: number | null
}

/** Aplica o desconto de um cupom sobre um preço em texto (ex: "R$89") e retorna o valor final formatado */
export function precoComDesconto(preco: string, desconto: CupomDesconto | null): string | null {
  if (!desconto) return null
  const valor = Number(preco.replace(/[^\d]/g, ''))
  if (!Number.isFinite(valor)) return null

  let final = valor
  if (desconto.percentOff != null) {
    final = valor * (1 - desconto.percentOff / 100)
  } else if (desconto.amountOff != null) {
    final = valor - desconto.amountOff / 100
  }
  final = Math.max(0, Math.round(final))
  return `R$${final}`
}

export function useCupom() {
  const [cupomAberto, setCupomAberto] = useState(false)
  const [cupomInput, setCupomInput] = useState('')
  const [cupomStatus, setCupomStatus] = useState<CupomStatus>('idle')
  const [cupomAplicado, setCupomAplicado] = useState('')
  const [desconto, setDesconto] = useState<CupomDesconto | null>(null)

  function resetCupom() {
    setCupomStatus('idle')
    setCupomAplicado('')
    setDesconto(null)
  }

  function onCupomInputChange(value: string) {
    setCupomInput(value.toUpperCase())
    if (cupomStatus !== 'idle') resetCupom()
  }

  async function aplicarCupom() {
    const code = cupomInput.trim().toUpperCase()
    if (!code) return
    setCupomStatus('loading')
    try {
      const res = await fetch('/api/stripe/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: code }),
      })
      const data = await res.json()
      if (res.ok) {
        setCupomStatus('ok')
        setCupomAplicado(code)
        setDesconto({ percentOff: data.percent_off ?? null, amountOff: data.amount_off ?? null })
      } else {
        setCupomStatus('erro')
        setCupomAplicado('')
        setDesconto(null)
      }
    } catch {
      setCupomStatus('erro')
      setCupomAplicado('')
      setDesconto(null)
    }
  }

  /** Marca o cupom como inválido — usado quando o checkout/upgrade rejeita o cupom no momento da confirmação */
  function marcarCupomInvalido() {
    setCupomStatus('erro')
    setCupomAplicado('')
    setDesconto(null)
  }

  return {
    cupomAberto,
    setCupomAberto,
    cupomInput,
    onCupomInputChange,
    cupomStatus,
    cupomAplicado,
    desconto,
    aplicarCupom,
    marcarCupomInvalido,
  }
}
