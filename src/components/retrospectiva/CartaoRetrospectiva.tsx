import { forwardRef } from 'react'
import { Heart, CalendarDays, Star, TrendingUp, TrendingDown, Award } from 'lucide-react'
import { NOMES_MESES, DIAS_SEMANA_PLURAL, type DadosRetrospectiva } from '@/lib/retrospectiva'

const CARD_WIDTH = 360
const CARD_HEIGHT = Math.round((CARD_WIDTH * 16) / 9)

const BRANCO = '#ffffff'

// Paleta fixa dos badges — deliberadamente NÃO usa classes de cor do
// Tailwind aqui (nem em nenhum outro lugar deste arquivo): o Tailwind v4
// gera oklch() por padrão, e mesmo com html2canvas-pro (que já suporta
// oklch) preferimos cores explícitas em hex/rgba pra ter controle exato da
// paleta vibrante pedida — cada badge com um tom bem diferente dos outros.
const CORES = {
  amarelo: { bg: '#fbbf24', texto: '#78350f' },
  verde: { bg: '#34d399', texto: '#064e3b' },
  vermelho: { bg: '#f87171', texto: '#7f1d1d' },
  roxo: { bg: '#c084fc', texto: '#581c87' },
  laranja: { bg: '#fb923c', texto: '#7c2d12' },
  azul: { bg: '#60a5fa', texto: '#1e3a8a' },
  neutro: { bg: '#e5e7eb', texto: '#374151' },
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function Badge({
  icon: Icon, label, valor, cor,
}: {
  icon: typeof Heart
  label: string
  valor: string
  cor: { bg: string; texto: string }
}) {
  return (
    <div
      className="rounded-2xl p-3 flex flex-col gap-1 border-2 min-w-0"
      style={{ backgroundColor: cor.bg, borderColor: BRANCO }}
    >
      <Icon className="w-4 h-4 shrink-0" style={{ color: cor.texto }} />
      <p className="text-[9px] font-bold uppercase tracking-wide leading-none truncate" style={{ color: cor.texto, opacity: 0.75 }}>
        {label}
      </p>
      <p className="text-sm font-extrabold leading-tight truncate" style={{ color: cor.texto }}>
        {valor}
      </p>
    </div>
  )
}

/** Card 9:16 estilo "Stories" com o resumo do mês — usado tanto no preview
 * do modal quanto como alvo do html2canvas pro download em PNG. `ref` aponta
 * pro elemento raiz, exatamente o que é capturado. Fundo sólido na cor do
 * tema da prestadora (tom escuro, já calibrado pra contraste com texto
 * branco em getTema) — maximalista de propósito, sem gradiente. */
export const CartaoRetrospectiva = forwardRef<HTMLDivElement, {
  mes: number
  ano: number
  dados: DadosRetrospectiva
  mostrarProfissionalDestaque: boolean
  prestadoraNome: string
  fotoUrl: string | null
  tema: { hex: string; hexDark: string }
}>(function CartaoRetrospectiva({ mes, ano, dados, mostrarProfissionalDestaque, prestadoraNome, fotoUrl, tema }, ref) {
  const nomeMes = NOMES_MESES[mes - 1]
  const crescimentoPositivo = dados.variacao_percentual === null ? null : dados.variacao_percentual >= 0
  const corCrescimento = crescimentoPositivo === null ? CORES.neutro : crescimentoPositivo ? CORES.verde : CORES.vermelho

  return (
    <div
      ref={ref}
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: tema.hexDark }}
      className="relative flex flex-col overflow-hidden shrink-0"
    >
      <div className="flex-1 min-h-0 flex flex-col px-6 pt-7 pb-4 overflow-hidden">
        {/* Foto + nome */}
        <div className="shrink-0 flex flex-col items-center">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- capturado pelo html2canvas; precisa de <img> real com crossOrigin, não next/image
            <img
              src={fotoUrl}
              alt={prestadoraNome}
              crossOrigin="anonymous"
              className="w-20 h-20 rounded-full object-cover border-4"
              style={{ borderColor: BRANCO }}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full border-4 flex items-center justify-center"
              style={{ borderColor: BRANCO, backgroundColor: tema.hex }}
            >
              <span className="font-serif text-2xl font-bold" style={{ color: BRANCO }}>{iniciais(prestadoraNome)}</span>
            </div>
          )}
          {/* w-full (não max-w-full) de propósito — dentro de um flex-col
              centralizado, um filho sem largura definida pode ficar com
              base de tamanho ambígua na hora do html2canvas clonar o
              documento pra capturar, truncando o nome mesmo sem precisar
              (widths implícitas de flexbox nem sempre reproduzem igual
              entre o layout ao vivo e o snapshot clonado). */}
          <p className="font-serif text-base font-bold mt-2.5 text-center truncate w-full" style={{ color: BRANCO }}>
            {prestadoraNome}
          </p>
          <p className="text-[11px] font-medium mt-0.5" style={{ color: BRANCO, opacity: 0.7 }}>
            Retrospectiva · {nomeMes} {ano}
          </p>
        </div>

        {!dados.tem_dados ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-center text-sm leading-relaxed font-medium" style={{ color: BRANCO }}>
              Esse mês ainda não teve atendimentos concluídos por aqui —
              <br />o próximo já pode entrar pra história! 💅
            </p>
          </div>
        ) : (
          <>
            {/* Número grande em destaque */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center py-2">
              <p data-numero-grande className="font-serif font-black leading-none text-7xl" style={{ color: BRANCO }}>
                {dados.total_agendamentos}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-widest mt-2.5" style={{ color: BRANCO, opacity: 0.8 }}>
                Atendimentos realizados
              </p>
            </div>

            {/* Grid 2x2 de badges coloridos */}
            <div className="shrink-0 grid grid-cols-2 gap-2">
              {dados.servico_mais_pedido && (
                <Badge icon={Heart} label="Serviço favorito" valor={dados.servico_mais_pedido} cor={CORES.amarelo} />
              )}
              <Badge
                icon={crescimentoPositivo === false ? TrendingDown : TrendingUp}
                label="Vs. mês anterior"
                valor={dados.variacao_percentual === null ? 'Primeiro mês' : `${dados.variacao_percentual > 0 ? '+' : ''}${dados.variacao_percentual}%`}
                cor={corCrescimento}
              />
              {dados.cliente_mais_agendou && (
                <Badge icon={Star} label="Cliente fiel" valor={dados.cliente_mais_agendou} cor={CORES.roxo} />
              )}
              {dados.dia_semana_mais_movimentado !== null && (
                <Badge icon={CalendarDays} label="Dia mais movimentado" valor={DIAS_SEMANA_PLURAL[dados.dia_semana_mais_movimentado]} cor={CORES.laranja} />
              )}
            </div>

            {mostrarProfissionalDestaque && dados.profissional_destaque && (
              <div className="shrink-0 mt-2">
                <Badge icon={Award} label="Profissional destaque" valor={dados.profissional_destaque} cor={CORES.azul} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Rodapé — overlay escuro sutil sobre o fundo do card */}
      <div className="shrink-0 flex items-center justify-center gap-1.5 py-3" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
        <span className="font-serif text-xs font-bold" style={{ color: BRANCO, opacity: 0.7 }}>BelleBook</span>
        <span className="text-xs" style={{ color: BRANCO, opacity: 0.7 }}>·</span>
        <span className="text-xs" style={{ color: BRANCO, opacity: 0.7 }}>bellebook.com.br</span>
      </div>
    </div>
  )
})
