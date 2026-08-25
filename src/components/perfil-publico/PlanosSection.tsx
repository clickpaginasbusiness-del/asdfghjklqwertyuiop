'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { CreditCard, QrCode, Sparkles, Users } from 'lucide-react'
import toast from 'react-hot-toast'

export type PlanoPublico = {
  id: string
  nome: string
  descricao: string | null
  preco: number
  intervalo: 'mensal' | 'bimensal' | 'trimestral' | 'semestral' | 'anual'
  desconto_tipo: 'percentual' | 'fixo'
  desconto_valor: number
  limite_vagas: number | null
  vagasOcupadas: number
  servicos: { nome: string; quantidade: number }[]
}

const NOME_INTERVALO: Record<PlanoPublico['intervalo'], string> = {
  mensal: 'mês',
  bimensal: '2 meses',
  trimestral: '3 meses',
  semestral: '6 meses',
  anual: 'ano',
}

/** Deriva um "rgba(...)" a partir do hex da cor_tema — mesmo helper usado no
 * preset Premium pra bordas/fundos com opacidade reduzida sem depender de
 * variantes fixas do Tailwind (a cor é dinâmica, escolhida pela prestadora). */
function hexComOpacidade(hex: string, alpha: number): string {
  const limpo = hex.replace('#', '')
  const cheio = limpo.length === 3 ? limpo.split('').map((c) => c + c).join('') : limpo
  const num = parseInt(cheio, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface Props {
  planos: PlanoPublico[]
  corTema: string
  dark?: boolean
  clienteLogado: { id: string; nome: string; telefone: string } | null
  onRequireLogin: () => void
}

/** Seção "Planos e assinaturas" + fluxo de assinar, compartilhada pelas 3
 * variantes de página pública (clássico, landing, premium). Login é
 * delegado ao modal de login que cada página já tem (via onRequireLogin) —
 * ao detectar que clienteLogado passou de null pra preenchido enquanto
 * havia uma assinatura pendente, reabre o modal de assinatura sozinha. */
export function PlanosSection({ planos, corTema, dark, clienteLogado, onRequireLogin }: Props) {
  const [modalPlano, setModalPlano] = useState<PlanoPublico | null>(null)
  const [metodo, setMetodo] = useState<'cartao' | 'pix'>('cartao')
  const [enviando, setEnviando] = useState(false)
  const [aguardandoLoginId, setAguardandoLoginId] = useState<string | null>(null)

  useEffect(() => {
    if (!clienteLogado || !aguardandoLoginId) return
    const plano = planos.find((p) => p.id === aguardandoLoginId)
    setAguardandoLoginId(null)
    if (plano) {
      setModalPlano(plano)
      setMetodo('cartao')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à transição de login, não a mudanças na lista de planos
  }, [clienteLogado])

  if (planos.length === 0) return null

  function abrirAssinar(plano: PlanoPublico) {
    if (!clienteLogado) {
      setAguardandoLoginId(plano.id)
      onRequireLogin()
      return
    }
    setModalPlano(plano)
    setMetodo('cartao')
  }

  async function confirmarAssinatura() {
    if (!modalPlano) return
    const token = localStorage.getItem('clienteToken')
    if (!token) { onRequireLogin(); return }
    // Dentro do app (Capacitor), window.open() não abre nada — a WebView não
    // implementa multi-window por padrão. Nesse caso usamos Browser.open() do
    // @capacitor/browser (Custom Tabs/SFSafariViewController) depois que a
    // Preference já voltou do servidor, sem precisar do truque da aba em
    // branco abaixo (Browser.open() é uma chamada nativa, não sofre o
    // bloqueio de popup que depende do gesto síncrono do clique).
    const nativo = Capacitor.isNativePlatform()
    // No navegador comum, abre a aba ANTES do fetch (síncrono, dentro do
    // próprio clique) — depois de um await, o navegador não reconhece mais o
    // clique original como o gesto que autoriza abrir aba nova, e o Safari em
    // especial bloqueia. Só troca a URL da aba já aberta quando a Preference
    // volta do servidor.
    const novaAba = nativo ? null : window.open('', '_blank')
    setEnviando(true)
    try {
      const res = await fetch(`/api/planos/${modalPlano.id}/assinar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, metodo }),
      })
      const data = await res.json()
      if (!res.ok) {
        novaAba?.close()
        toast.error(data.error ?? 'Erro ao assinar plano')
        return
      }
      if (nativo) await Browser.open({ url: data.url })
      else if (novaAba) novaAba.location.href = data.url
      else window.open(data.url, '_blank', 'noopener,noreferrer')
      setModalPlano(null)
      toast.success('Pagamento aberto em outra aba — assim que confirmar, sua assinatura já aparece aqui.')
    } catch {
      novaAba?.close()
      toast.error('Erro ao assinar plano')
    } finally {
      setEnviando(false)
    }
  }

  const cardBase = dark
    ? 'bg-[#1a1a1a] text-white'
    : 'bg-white text-gray-900 border border-gray-100 shadow-sm'

  return (
    <>
      <section id="planos" className={dark ? 'bg-[#111111] px-4 py-16' : undefined}>
        <div className={dark ? 'max-w-5xl mx-auto' : undefined}>
          <h2 className={dark
            ? 'font-serif text-2xl sm:text-3xl font-semibold text-white mb-2 text-center'
            : 'font-serif text-xl font-semibold text-gray-900 mb-1'}
          >
            Planos e assinaturas
          </h2>
          <p className={dark ? 'text-sm text-gray-400 mb-8 text-center' : 'text-sm text-gray-500 mb-4'}>
            Assine e economize nos seus atendimentos
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            {planos.map((plano) => {
              const vagasRestantes = plano.limite_vagas != null ? Math.max(0, plano.limite_vagas - plano.vagasOcupadas) : null
              const esgotado = vagasRestantes === 0
              return (
                <div
                  key={plano.id}
                  className={`w-full sm:w-[calc(50%_-_8px)] max-w-md rounded-2xl p-5 ${cardBase}`}
                  style={dark ? { border: `1px solid ${hexComOpacidade(corTema, 0.3)}` } : undefined}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{plano.nome}</h3>
                    {plano.desconto_valor > 0 && (
                      <Badge className="shrink-0" style={{ backgroundColor: hexComOpacidade(corTema, dark ? 0.2 : 0.12), color: corTema }}>
                        {plano.desconto_tipo === 'percentual' ? `${plano.desconto_valor}% OFF` : `${formatCurrency(plano.desconto_valor)} OFF`}
                      </Badge>
                    )}
                  </div>

                  {plano.descricao && (
                    <p className={dark ? 'text-sm text-gray-400 mb-3' : 'text-sm text-gray-500 mb-3'}>{plano.descricao}</p>
                  )}

                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-2xl font-bold" style={{ color: corTema }}>{formatCurrency(plano.preco)}</span>
                    <span className={dark ? 'text-xs text-gray-500' : 'text-xs text-gray-400'}>/{NOME_INTERVALO[plano.intervalo]}</span>
                  </div>

                  {plano.servicos.length > 0 && (
                    <ul className={`text-xs space-y-1 mb-4 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {plano.servicos.map((s, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 shrink-0" style={{ color: corTema }} />
                          {s.quantidade}x {s.nome}
                        </li>
                      ))}
                    </ul>
                  )}

                  {vagasRestantes != null && !esgotado && (
                    <p className={`text-[11px] mb-3 flex items-center gap-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                      <Users className="w-3 h-3" /> {vagasRestantes} vaga{vagasRestantes === 1 ? '' : 's'} restante{vagasRestantes === 1 ? '' : 's'}
                    </p>
                  )}

                  <Button
                    onClick={() => abrirAssinar(plano)}
                    disabled={esgotado}
                    className="w-full hover:brightness-95"
                    style={esgotado ? undefined : { backgroundColor: corTema }}
                  >
                    {esgotado ? 'Esgotado' : 'Assinar'}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <Modal open={!!modalPlano} onClose={() => setModalPlano(null)} title={modalPlano ? `Assinar ${modalPlano.nome}` : undefined}>
        {modalPlano && (
          <div className="p-6 space-y-5">
            <div className="rounded-xl p-3 text-sm space-y-1" style={{ backgroundColor: hexComOpacidade(corTema, 0.08) }}>
              <div className="flex justify-between">
                <span className="text-gray-600">Valor</span>
                <span className="font-medium text-gray-900">{formatCurrency(modalPlano.preco)} / {NOME_INTERVALO[modalPlano.intervalo]}</span>
              </div>
              {modalPlano.servicos.length > 0 && (
                <p className="text-xs text-gray-500 pt-1">
                  {modalPlano.servicos.map((s, i) => <span key={i}>{i > 0 && ' · '}{s.quantidade}x {s.nome}</span>)}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMetodo('cartao')}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm font-medium transition-all ${metodo === 'cartao' ? 'text-white' : 'text-gray-600 border-gray-200'}`}
                  style={metodo === 'cartao' ? { backgroundColor: corTema, borderColor: corTema } : undefined}
                >
                  <CreditCard className="w-4 h-4" />
                  Cartão de crédito
                </button>
                <button
                  onClick={() => setMetodo('pix')}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm font-medium transition-all ${metodo === 'pix' ? 'text-white' : 'text-gray-600 border-gray-200'}`}
                  style={metodo === 'pix' ? { backgroundColor: corTema, borderColor: corTema } : undefined}
                >
                  <QrCode className="w-4 h-4" />
                  Pix automático
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Ao confirmar, você autoriza cobranças recorrentes de {formatCurrency(modalPlano.preco)} a cada {NOME_INTERVALO[modalPlano.intervalo]}, até que a assinatura seja cancelada.
            </p>

            <Button onClick={confirmarAssinatura} loading={enviando} className="w-full" style={{ backgroundColor: corTema }}>
              Confirmar assinatura
            </Button>
          </div>
        )}
      </Modal>
    </>
  )
}
