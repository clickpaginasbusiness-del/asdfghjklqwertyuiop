'use client'

import { Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { AssinaturaComCredito } from './usePlanoCredito'

interface Props {
  assinatura: AssinaturaComCredito
  usarCredito: boolean
  onChange: (usar: boolean) => void
  dark?: boolean
}

/** Badge + checkbox "Usar crédito do plano" no passo de confirmação do
 * agendamento — mesma UI nas 3 variantes de página pública. Desmarcar
 * significa "pagar normalmente dessa vez", sem consumir crédito. O preset
 * Premium (fundo escuro) usa cores diferentes pra manter contraste — as
 * outras duas variantes já são claras, então o verde-claro padrão serve. */
export function CreditoPlanoCard({ assinatura, usarCredito, onChange, dark }: Props) {
  const creditosApos = Math.max(0, assinatura.creditosRestantes - 1)

  return (
    <label
      className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors"
      style={dark
        ? { borderColor: usarCredito ? 'rgba(52, 211, 153, 0.5)' : 'rgba(255,255,255,0.1)', backgroundColor: usarCredito ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }
        : { borderColor: usarCredito ? '#6ee7b7' : '#e5e7eb', backgroundColor: usarCredito ? '#ecfdf5' : 'white' }}
    >
      <input
        type="checkbox"
        checked={usarCredito}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-emerald-500 w-4 h-4"
      />
      <div className="min-w-0 flex-1">
        <div className={`flex items-center gap-1.5 text-sm font-medium ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>
          <Sparkles className="w-3.5 h-3.5" />
          Plano {assinatura.planoNome}
        </div>
        {assinatura.descontoValor > 0 && (
          <p className={`text-xs mt-0.5 ${dark ? 'text-emerald-500' : 'text-emerald-600'}`}>
            Desconto de {assinatura.descontoTipo === 'percentual' ? `${assinatura.descontoValor}%` : formatCurrency(assinatura.descontoValor)} aplicado
          </p>
        )}
        <p className={`text-xs mt-0.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
          {usarCredito
            ? `Este agendamento usará 1 crédito (restam ${creditosApos} após este)`
            : `Você tem ${assinatura.creditosRestantes} crédito${assinatura.creditosRestantes === 1 ? '' : 's'} disponível — pagando normalmente dessa vez`}
        </p>
      </div>
    </label>
  )
}
