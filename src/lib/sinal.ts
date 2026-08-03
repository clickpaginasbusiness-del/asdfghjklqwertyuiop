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
