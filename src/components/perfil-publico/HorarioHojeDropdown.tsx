'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock, ChevronDown } from 'lucide-react'
import { cn, formatHora, diaAtivoPadrao } from '@/lib/utils'
import { hexComOpacidade } from '@/lib/theme'
import type { HorarioFuncionamento } from '@/lib/types'

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

interface Props {
  horariosFuncionamento: HorarioFuncionamento[]
  horaAberturaPadrao: string
  horaFechamentoPadrao: string
  diaAtual: number
  tema: { hex: string; hexLight: string; hexDark: string }
  dark?: boolean
}

/** Badge "Hoje: 9h – 18h" com chevron que expande os horários da semana
 * inteira — mesma UI nas 3 variantes de página pública. O resumo de "hoje"
 * funde os dois turnos num único intervalo (abertura do turno1 até
 * fechamento do turno2, se houver); o dropdown expandido é que mostra os
 * turnos separados por dia, quando existirem. */
export function HorarioHojeDropdown({
  horariosFuncionamento, horaAberturaPadrao, horaFechamentoPadrao, diaAtual, tema, dark,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const horarioHoje = horariosFuncionamento.find((h) => h.dia_semana === diaAtual)
  const aberturaHoje = horarioHoje?.hora_abertura ?? horaAberturaPadrao
  const fechamentoHoje = horarioHoje?.hora_fechamento ?? horaFechamentoPadrao
  // Envelope do resumo: turno1 até o fim do turno2 (se houver e for depois do
  // fechamento do turno1) — mesmo raciocínio de fechamentoGrade em
  // AgendaDoDiaSection.tsx. Os turnos separados só aparecem no dropdown.
  const fechamentoEnvelopeHoje = horarioHoje?.turno2_fim && horarioHoje.turno2_fim.slice(0, 5) > fechamentoHoje.slice(0, 5)
    ? horarioHoje.turno2_fim
    : fechamentoHoje

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          'inline-flex items-center gap-1.5 text-xs rounded-lg -mx-1.5 -my-1 px-1.5 py-1 transition-colors',
          dark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'
        )}
      >
        <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: tema.hex }} />
        Hoje: {formatHora(aberturaHoje)} – {formatHora(fechamentoEnvelopeHoje)}
        <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className={cn(
            'animate-dropdown-in absolute left-1/2 -translate-x-1/2 top-full mt-2 w-60 rounded-xl shadow-lg z-30 py-1.5',
            dark ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white border border-gray-100'
          )}
        >
          {DIAS_SEMANA.map((nome, diaSemana) => {
            const horario = horariosFuncionamento.find((h) => h.dia_semana === diaSemana)
            const ativo = horario ? horario.ativo : diaAtivoPadrao(diaSemana)
            const abertura = horario?.hora_abertura ?? horaAberturaPadrao
            const fechamento = horario?.hora_fechamento ?? horaFechamentoPadrao
            const ehHoje = diaSemana === diaAtual

            return (
              <div
                key={diaSemana}
                className="flex items-center justify-between gap-3 px-3.5 py-1.5 text-xs"
                style={ehHoje ? { backgroundColor: dark ? hexComOpacidade(tema.hex, 0.12) : tema.hexLight } : undefined}
              >
                <span
                  className={cn(
                    !ativo && (dark ? 'text-gray-600' : 'text-gray-400'),
                    ativo && !ehHoje && (dark ? 'text-gray-300' : 'text-gray-600'),
                    ehHoje && 'font-semibold'
                  )}
                  style={ativo && ehHoje ? { color: tema.hexDark } : undefined}
                >
                  {nome}
                </span>
                <span
                  className={cn(
                    'text-right',
                    !ativo && (dark ? 'text-gray-600' : 'text-gray-400'),
                    ativo && !ehHoje && (dark ? 'text-gray-400' : 'text-gray-500'),
                    ativo && ehHoje && 'font-semibold'
                  )}
                  style={ativo && ehHoje ? { color: tema.hexDark } : undefined}
                >
                  {ativo ? (
                    <>
                      {formatHora(abertura)} – {formatHora(fechamento)}
                      {horario?.turno2_inicio && horario?.turno2_fim && (
                        <>, {formatHora(horario.turno2_inicio)} – {formatHora(horario.turno2_fim)}</>
                      )}
                    </>
                  ) : 'Fechado'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
