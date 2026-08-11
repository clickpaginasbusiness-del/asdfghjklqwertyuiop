export type CorTema = 'rosa' | 'roxo' | 'azul' | 'verde' | 'amarelo' | 'laranja' | 'vermelho' | 'preto'

export const TEMA_DEFAULT: CorTema = 'rosa'

export const TEMAS: Record<CorTema, { label: string; hex: string; hexLight: string; hexDark: string; hexHeader: string }> = {
  rosa:     { label: 'Rosa',     hex: '#fb7185', hexLight: '#fff1f2', hexDark: '#e11d48', hexHeader: '#fce4ec' },
  roxo:     { label: 'Roxo',     hex: '#c084fc', hexLight: '#faf5ff', hexDark: '#9333ea', hexHeader: '#ede7f6' },
  azul:     { label: 'Azul',     hex: '#60a5fa', hexLight: '#eff6ff', hexDark: '#2563eb', hexHeader: '#e3f2fd' },
  verde:    { label: 'Verde',    hex: '#34d399', hexLight: '#ecfdf5', hexDark: '#059669', hexHeader: '#e8f5e9' },
  amarelo:  { label: 'Amarelo',  hex: '#fbbf24', hexLight: '#fffbeb', hexDark: '#d97706', hexHeader: '#fffde7' },
  laranja:  { label: 'Laranja',  hex: '#fb923c', hexLight: '#fff7ed', hexDark: '#ea580c', hexHeader: '#fff3e0' },
  vermelho: { label: 'Vermelho', hex: '#f87171', hexLight: '#fef2f2', hexDark: '#dc2626', hexHeader: '#ffebee' },
  preto:    { label: 'Preto',    hex: '#18181b', hexLight: '#f4f4f5', hexDark: '#3f3f46', hexHeader: '#f5f5f5' },
}

const HEX_REGEX = /^#(?:[0-9a-f]{6}|[0-9a-f]{3})$/i

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let [r, g, b] = [0, 0, 0]
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Deriva os tons claro/escuro/header de uma cor RGB livre, na mesma linha dos
 * presets nomeados acima (que foram calibrados à mão) — usado quando a
 * prestadora escolhe uma cor pelo color picker em vez de um preset. */
function derivarSombras(hex: string): { hexLight: string; hexDark: string; hexHeader: string } {
  const [r, g, b] = hexToRgb(hex)
  const [h, s] = rgbToHsl(r, g, b)
  return {
    hexDark: hslToHex(h, Math.min(100, s * 1.05), 40),
    hexLight: hslToHex(h, Math.max(20, s * 0.35), 97),
    hexHeader: hslToHex(h, Math.max(25, s * 0.5), 93),
  }
}

/** Aceita tanto uma chave de preset ('rosa', 'roxo'...) quanto um hex livre
 * (#rrggbb, vindo do color picker) — mantém compatibilidade com contas que já
 * tinham um preset salvo antes dessa cor livre existir. */
export function getTema(cor: string | null | undefined) {
  if (cor && cor in TEMAS) return TEMAS[cor as CorTema]
  if (cor && HEX_REGEX.test(cor)) {
    return { label: 'Personalizada', hex: cor, ...derivarSombras(cor) }
  }
  return TEMAS[TEMA_DEFAULT]
}

/** Deriva um "rgba(...)" a partir de um hex — usado em fundos/bordas com
 * opacidade reduzida sobre o tema dinâmico da prestadora (estilo inline não
 * tem variante de opacidade do Tailwind, então calcula na mão). */
export function hexComOpacidade(hex: string, alpha: number): string {
  const limpo = hex.replace('#', '')
  const cheio = limpo.length === 3 ? limpo.split('').map((c) => c + c).join('') : limpo
  const num = parseInt(cheio, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
