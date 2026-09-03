// Dados de preço dos planos — módulo puro, sem side-effect nenhum (não
// instancia SDK, não lê secret de ambiente), pra poder ser importado tanto
// de código de servidor (mercadopago.ts reexporta tudo daqui) quanto direto
// de componentes client — antes cada tela client duplicava esses números
// (Pro/Studio em 5 arquivos independentes: mercadopago.ts, PlanosClient.tsx,
// CheckoutClient.tsx, AssinaturaClient.tsx, LandingPage.tsx), e dois
// componentes admin ('use client') importavam PRECOS/NOME_PLANO direto de
// mercadopago.ts, empacotando o SDK do Mercado Pago inteiro (com
// MercadoPagoConfig e access token) no bundle do navegador sem necessidade.

export type Plano = 'start' | 'pro' | 'studio'
export type Ciclo = 'mensal' | 'anual'

/** Preços em reais — únicos "price IDs" que existem são os 3 preapproval_plan
 * de cartão+mensal (ver getOrCreatePlanoMensal em mercadopago.ts); anual é
 * sempre pagamento avulso via Preference, com o preço fixo lido daqui direto. */
export const PRECOS: Record<Plano, Record<Ciclo, number>> = {
  start: { mensal: 29, anual: 240 },
  pro: { mensal: 89, anual: 855 },
  studio: { mensal: 119, anual: 1142 },
}

/** Preço de tabela anterior do Start, mantido só pra exibir riscado nas
 * vitrines comparativas (landing, /planos) — não usar pra cobrança. */
export const PRECO_START_ANTERIOR: Record<Ciclo, number> = { mensal: 49, anual: 470 }

export const NOME_PLANO: Record<Plano, string> = {
  start: 'Start',
  pro: 'Pro',
  studio: 'Studio',
}

/** Percentual exato de desconto entre dois preços, arredondado pro inteiro
 * mais próximo — usado pro badge "X% off" ao lado do preço riscado. */
export function percentualDesconto(antigo: number, novo: number): number {
  return Math.round((1 - novo / antigo) * 100)
}

/** Formata um valor em reais sem casas decimais (ex.: 89 -> "R$89"), mesmo
 * estilo já usado nas vitrines de preço. */
export function formatarPrecoInteiro(valor: number): string {
  return `R$${Math.round(valor).toLocaleString('pt-BR')}`
}

/** Valor mensal equivalente de um preço anual, arredondado (ex.: 855/12 ->
 * "R$71"), usado como legenda abaixo do preço anual nas vitrines. */
export function mensalEquivalenteFormatado(precoAnual: number): string {
  return formatarPrecoInteiro(precoAnual / 12)
}
