/** Taxa da plataforma sobre sinal/pagamento de serviço recebido pelo app — o
 * valor bruto pago pela cliente não muda, só o líquido que cai no caixa da
 * prestadora (ver caixa_prestadora / /painel/caixa). */
export const TAXA_PLATAFORMA_PERCENTUAL = 7

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Valor do sinal a cobrar da cliente — fixo (capado no preço do serviço,
 * pra evitar um sinal configurado maior que o próprio serviço) ou percentual
 * sobre o preço. */
export function calcularValorSinal(
  preco: number,
  sinalTipo: 'fixo' | 'percentual' | null,
  sinalValor: number | null
): number {
  if (!sinalTipo || sinalValor == null) return preco
  if (sinalTipo === 'fixo') return round2(Math.min(preco, sinalValor))
  return round2(preco * (sinalValor / 100))
}

/** Valor líquido que a prestadora recebe, depois de descontar a taxa da plataforma. */
export function calcularValorLiquido(valorBruto: number): number {
  return round2(valorBruto * (1 - TAXA_PLATAFORMA_PERCENTUAL / 100))
}

export interface DescontoPlano {
  tipo: 'percentual' | 'fixo'
  valor: number
}

/** Preço do serviço já com o desconto do plano de assinatura aplicado (se
 * houver) — SEMPRE calculado sobre o preço cheio do serviço, nunca sobre o
 * sinal (bug corrigido: antes o desconto era aplicado depois do valor já
 * ter virado sinal, então um desconto de 50% num sinal de R$10 saía R$5 em
 * vez de refletir 50% dos R$100 do serviço). */
export function calcularPrecoComDesconto(preco: number, desconto?: DescontoPlano | null): number {
  if (!desconto || !desconto.valor) return preco
  const final = desconto.tipo === 'percentual' ? preco * (1 - desconto.valor / 100) : preco - desconto.valor
  return Math.max(0, round2(final))
}

export interface ValorAgendamento {
  /** Preço cheio do serviço já com desconto de plano — só relevante quando
   * `cobrarSinal` é false (pagamento do valor completo online). */
  precoComDesconto: number
  /** Valor do sinal — sempre sobre o preço ORIGINAL, nunca afetado por
   * desconto de plano, seja o sinal fixo ou percentual. O desconto do plano
   * existe pra reduzir o valor do SERVIÇO; o sinal é só uma reserva de
   * compromisso, de natureza diferente, e nunca reflete esse desconto. O
   * desconto só se realiza de fato quando a cliente paga o valor completo
   * online (ver `precoComDesconto`/`valorACobrar` com `cobrarSinal: false`). */
  sinal: number
  /** O que é efetivamente cobrado agora — sinal (sem desconto) ou o preço
   * completo já descontado. */
  valorACobrar: number
}

/** Calcula tudo que o checkout de um agendamento com pagamento online
 * precisa exibir/cobrar. Usado tanto no preview (páginas públicas) quanto na
 * cobrança real (/api/agendamentos/pagar) — mesma fórmula nos dois lugares,
 * pra nunca divergir. */
export function calcularValorFinalAgendamento(
  preco: number,
  sinalTipo: 'fixo' | 'percentual' | null,
  sinalValor: number | null,
  cobrarSinal: boolean,
  desconto?: DescontoPlano | null
): ValorAgendamento {
  const precoComDesconto = calcularPrecoComDesconto(preco, desconto)
  const sinal = calcularValorSinal(preco, sinalTipo, sinalValor)
  const valorACobrar = cobrarSinal ? sinal : precoComDesconto
  return { precoComDesconto, sinal, valorACobrar }
}
