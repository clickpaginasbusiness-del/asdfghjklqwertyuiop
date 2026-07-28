'use client'

import { useEffect, useRef, useState } from 'react'
import { Flame, Tag, AlertTriangle } from 'lucide-react'
import { getMissaoIcone } from '@/lib/missaoIcones'
import { cn } from '@/lib/utils'
import type { Missao, MissaoProgresso, MissaoDesconto } from '@/lib/types'

type MissaoComProgresso = MissaoProgresso & { missoes: Missao }

interface Resposta {
  missoes: MissaoComProgresso[]
  descontosPendentes: MissaoDesconto[]
}

const MES_ANO_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
})

const DATA_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
})

function descricaoAdaptada(descricao: string, meta: number): string {
  return descricao.replace(/\bX\b/g, meta.toLocaleString('pt-BR'))
}

export function MissoesDrawer() {
  const [dados, setDados] = useState<Resposta | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const emAndamento = dados?.missoes.filter((m) => !m.concluida).length ?? 0

  useEffect(() => {
    let mounted = true
    fetch('/api/missoes')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (mounted && data) setDados(data) })
      .finally(() => { if (mounted) setCarregando(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleToggle() {
    setOpen((v) => !v)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        className="relative w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="Objetivos do mês"
      >
        <Flame className="w-5 h-5" />
        {emAndamento > 0 && (
          <span className="absolute top-1 right-1 bg-gradient-to-br from-rose-500 to-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
            {emAndamento > 9 ? '9+' : emAndamento}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="bg-gradient-to-r from-rose-400 to-orange-400 px-4 py-4">
            <h3 className="font-semibold text-white text-sm flex items-center gap-1.5">
              🔥 Objetivos do mês
            </h3>
            <p className="text-white/80 text-xs mt-0.5 capitalize">{MES_ANO_FORMAT.format(new Date())}</p>
          </div>

          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {carregando ? (
              <div className="py-10 text-center text-gray-400 text-sm">Carregando...</div>
            ) : !dados || dados.missoes.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm px-6">
                Nenhum objetivo disponível ainda. Volte em breve!
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {dados.missoes.map((m) => {
                  const Icone = getMissaoIcone(m.missoes.icone)
                  const pct = Math.min(100, Math.round((m.progresso / Math.max(1, m.meta_adaptada)) * 100))
                  const ehBonusIndicacao = m.missoes.tipo === 'indicacao_bonus'
                  const recompensa = ehBonusIndicacao
                    ? '🎁 1 mês grátis'
                    : `🏷️ ${m.missoes.desconto_percentual}% de desconto`
                  return (
                    <div key={m.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                          m.concluida ? 'bg-emerald-50' : 'bg-rose-50'
                        )}>
                          <Icone className={cn('w-4 h-4', m.concluida ? 'text-emerald-500' : 'text-rose-400')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 text-sm">{m.missoes.titulo}</p>
                            {m.e_bonus && (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">
                                Bônus
                              </span>
                            )}
                            {m.concluida && (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                ✓ Concluída
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                            {descricaoAdaptada(m.missoes.descricao, m.meta_adaptada)}
                          </p>

                          <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                m.concluida ? 'bg-emerald-400' : 'bg-gradient-to-r from-rose-400 to-orange-400'
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[11px] text-gray-400">
                              {Math.min(m.progresso, m.meta_adaptada)} / {m.meta_adaptada}
                            </span>
                            <span className="text-[11px] font-medium text-gray-600">
                              {recompensa}
                              {ehBonusIndicacao && <span className="text-gray-400"> · Sem expiração</span>}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {dados && dados.descontosPendentes.length > 0 && (
            <div className="border-t border-amber-100">
              <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-600 leading-relaxed">
                  ⚠️ Descontos de missões expiram no final do mês. Não acumulam para o mês seguinte!
                </p>
              </div>
              <div className="px-4 py-3 bg-amber-50 space-y-1.5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                  <Tag className="w-3.5 h-3.5" />
                  Descontos aguardando
                </p>
                <div className="space-y-1">
                  {dados.descontosPendentes.map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-xs">
                      <span className="text-amber-700 truncate pr-2">{d.origem} — {d.percentual}%</span>
                      <span className="text-amber-500 shrink-0 whitespace-nowrap">
                        {d.expira_em ? `Expira em ${DATA_FORMAT.format(new Date(d.expira_em))}` : 'Sem expiração'}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mt-0.5">Serão aplicados na próxima fatura.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
