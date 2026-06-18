export type CorTema = 'rosa' | 'roxo' | 'azul' | 'verde' | 'amarelo' | 'laranja' | 'vermelho' | 'preto'

export const TEMA_DEFAULT: CorTema = 'rosa'

export const TEMAS: Record<CorTema, { label: string; hex: string; hexLight: string; hexDark: string }> = {
  rosa:     { label: 'Rosa',     hex: '#fb7185', hexLight: '#fff1f2', hexDark: '#e11d48' },
  roxo:     { label: 'Roxo',     hex: '#c084fc', hexLight: '#faf5ff', hexDark: '#9333ea' },
  azul:     { label: 'Azul',     hex: '#60a5fa', hexLight: '#eff6ff', hexDark: '#2563eb' },
  verde:    { label: 'Verde',    hex: '#34d399', hexLight: '#ecfdf5', hexDark: '#059669' },
  amarelo:  { label: 'Amarelo',  hex: '#fbbf24', hexLight: '#fffbeb', hexDark: '#d97706' },
  laranja:  { label: 'Laranja',  hex: '#fb923c', hexLight: '#fff7ed', hexDark: '#ea580c' },
  vermelho: { label: 'Vermelho', hex: '#f87171', hexLight: '#fef2f2', hexDark: '#dc2626' },
  preto:    { label: 'Preto',    hex: '#18181b', hexLight: '#f4f4f5', hexDark: '#3f3f46' },
}

export function getTema(cor: string | null | undefined) {
  return TEMAS[cor as CorTema] ?? TEMAS[TEMA_DEFAULT]
}
