import { forwardRef } from 'react'
import { CalendarCheck2, Heart, CalendarDays, Star, TrendingUp, TrendingDown, Award } from 'lucide-react'
import { NOMES_MESES, DIAS_SEMANA_PLURAL, type DadosRetrospectiva } from '@/lib/retrospectiva'

const CARD_WIDTH = 360
const CARD_HEIGHT = Math.round((CARD_WIDTH * 16) / 9)

function Metrica({
  icon: Icon, label, valor, corValor = 'text-white',
}: {
  icon: typeof CalendarCheck2
  label: string
  valor: React.ReactNode
  corValor?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-white/75 text-[11px] font-medium uppercase tracking-wide leading-none">{label}</p>
        <p className={`font-serif font-bold text-lg leading-tight mt-1 truncate ${corValor}`}>{valor}</p>
      </div>
    </div>
  )
}

/** Card 9:16 estilo "Stories" com o resumo do mês — usado tanto no preview
 * do modal quanto como alvo do html2canvas pro download em PNG. `ref` aponta
 * pro elemento raiz, exatamente o que é capturado. */
export const CartaoRetrospectiva = forwardRef<HTMLDivElement, {
  mes: number
  ano: number
  dados: DadosRetrospectiva
  mostrarProfissionalDestaque: boolean
}>(function CartaoRetrospectiva({ mes, ano, dados, mostrarProfissionalDestaque }, ref) {
  const nomeMes = NOMES_MESES[mes - 1]

  return (
    <div
      ref={ref}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        background: 'linear-gradient(160deg, #fce4ec 0%, #f9a8c9 55%, #f472b6 100%)',
      }}
      className="relative flex flex-col px-7 py-8 overflow-hidden shrink-0"
    >
      {/* Topo */}
      <div className="shrink-0">
        <p className="font-serif text-sm font-bold text-white/90 text-center">BelleBook</p>
        <h1 className="font-serif text-3xl font-bold text-white text-center mt-4 leading-tight">Sua Retrospectiva</h1>
        <p className="text-white/85 text-sm font-medium text-center mt-1.5">{nomeMes} {ano}</p>
        <div className="h-px bg-white/30 mt-6" />
      </div>

      {/* Métricas */}
      <div className="flex-1 min-h-0 flex flex-col justify-center gap-5 py-6">
        {!dados.tem_dados ? (
          <p className="text-white text-center text-sm leading-relaxed font-medium">
            Esse mês ainda não teve atendimentos concluídos por aqui —
            <br />o próximo já pode entrar pra história! 💅
          </p>
        ) : (
          <>
            <Metrica icon={CalendarCheck2} label="Atendimentos realizados" valor={dados.total_agendamentos} />

            {dados.servico_mais_pedido && (
              <Metrica icon={Heart} label="Serviço favorito das clientes" valor={dados.servico_mais_pedido} />
            )}

            {dados.dia_semana_mais_movimentado !== null && (
              <Metrica icon={CalendarDays} label="Dia mais movimentado" valor={DIAS_SEMANA_PLURAL[dados.dia_semana_mais_movimentado]} />
            )}

            {dados.cliente_mais_agendou && (
              <Metrica icon={Star} label="Cliente fiel do mês" valor={dados.cliente_mais_agendou} />
            )}

            <Metrica
              icon={dados.variacao_percentual !== null && dados.variacao_percentual < 0 ? TrendingDown : TrendingUp}
              label="Vs. mês anterior"
              corValor={dados.variacao_percentual === null ? 'text-white/70' : 'text-emerald-200'}
              valor={
                dados.variacao_percentual === null
                  ? 'Primeiro mês por aqui'
                  : `${dados.variacao_percentual > 0 ? '+' : ''}${dados.variacao_percentual}% de atendimentos`
              }
            />

            {mostrarProfissionalDestaque && dados.profissional_destaque && (
              <Metrica icon={Award} label="Profissional destaque" valor={dados.profissional_destaque} />
            )}
          </>
        )}
      </div>

      {/* Rodapé */}
      <div className="shrink-0 flex items-center justify-center gap-1.5">
        <span className="font-serif text-xs font-bold text-white/60">BelleBook</span>
        <span className="text-white/60 text-xs">·</span>
        <span className="text-white/60 text-xs">bellebook.com.br</span>
      </div>
    </div>
  )
})
