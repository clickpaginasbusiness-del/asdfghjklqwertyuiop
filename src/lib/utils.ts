import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { parseISO, isValid } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function parseDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null
  const d = typeof date === 'string' ? parseISO(date) : date
  return isValid(d) ? d : null
}

/*
 * Datas sempre formatadas fixando o fuso de São Paulo via Intl.DateTimeFormat.
 * O servidor (Vercel/Node roda em UTC) e o navegador da cliente (horário local)
 * produziam textos diferentes para o mesmo instante — isso gerava erro de
 * hidratação do React (#418) nas páginas que mostram data/hora de agendamento.
 */
const FUSO_SP = 'America/Sao_Paulo'

function partesDataSP(d: Date) {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_SP,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { dd: get('day'), MM: get('month'), yyyy: get('year'), HH: get('hour'), mm: get('minute') }
}

export function formatDate(date: string | Date | null | undefined): string {
  const d = parseDate(date)
  if (!d) return '—'
  const { dd, MM, yyyy } = partesDataSP(d)
  return `${dd}/${MM}/${yyyy}`
}

export function formatDateTime(date: string | Date | null | undefined): string {
  const d = parseDate(date)
  if (!d) return '—'
  const { dd, MM, yyyy, HH, mm } = partesDataSP(d)
  return `${dd}/${MM}/${yyyy} às ${HH}h${mm}`
}

export function formatDateShort(date: string | Date | null | undefined): string {
  const d = parseDate(date)
  if (!d) return '—'
  const { dd, MM, HH, mm } = partesDataSP(d)
  return `${dd}/${MM} às ${HH}h${mm}`
}

export function formatDayMonth(date: string | Date | null | undefined): string {
  const d = parseDate(date)
  if (!d) return '—'
  const { dd, MM } = partesDataSP(d)
  return `${dd}/${MM}`
}

export function formatTime(date: string | Date | null | undefined): string {
  const d = parseDate(date)
  if (!d) return '—'
  const { HH, mm } = partesDataSP(d)
  return `${HH}:${mm}`
}

/** Chave 'yyyy-MM-dd' do dia calendário em São Paulo (para agrupar/comparar dias sem depender do fuso do runtime). */
export function formatDateKey(date: string | Date | null | undefined): string {
  const d = parseDate(date)
  if (!d) return ''
  const { dd, MM, yyyy } = partesDataSP(d)
  return `${yyyy}-${MM}-${dd}`
}

export function formatWeekdayShort(date: string | Date | null | undefined): string {
  const d = parseDate(date)
  if (!d) return ''
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_SP, weekday: 'short' })
    .format(d)
    .replace('.', '')
}

/** Meia-noite de "hoje" em São Paulo, representada como instante UTC estável (independe do fuso do runtime). */
export function startOfTodaySP(): Date {
  const { yyyy, MM, dd } = partesDataSP(new Date())
  return new Date(Date.UTC(Number(yyyy), Number(MM) - 1, Number(dd), 3, 0, 0))
}

/** Converte uma chave 'yyyy-MM-dd' de volta para o instante de meia-noite em São Paulo daquele dia. */
export function dateKeyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0))
}

/**
 * Quando a prestadora nunca salvou horarios_funcionamento para um dia (sem linha
 * no banco), esse é o padrão assumido — precisa bater com o DEFAULTS mostrado em
 * HorariosClient.tsx (domingo desativado, resto ativo), senão a página pública
 * libera agendamento em dias que a prestadora nunca teve como "ativos" de fato.
 */
export function diaAtivoPadrao(diaSemana: number): boolean {
  return diaSemana !== 0
}

export function generateTimeSlots(
  horaAbertura: string,
  horaFechamento: string,
  duracaoMinutos: number
): string[] {
  const slots: string[] = []
  const [startH, startM] = horaAbertura.split(':').map(Number)
  const [endH, endM] = horaFechamento.split(':').map(Number)

  let currentMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  while (currentMinutes + duracaoMinutos <= endMinutes) {
    const h = Math.floor(currentMinutes / 60)
    const m = currentMinutes % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    currentMinutes += duracaoMinutos
  }

  return slots
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export function maskTelefone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function cleanTelefone(value: string): string {
  return value.replace(/\D/g, '')
}

export function toE164(telefoneDigits: string): string {
  const digits = telefoneDigits.replace(/\D/g, '')
  return digits.startsWith('55') && digits.length >= 12 ? `+${digits}` : `+55${digits}`
}

export function buildWhatsappUrl(telefone: string, mensagem?: string): string {
  const limpo = cleanTelefone(telefone)
  const numero = limpo.startsWith('55') ? limpo : `55${limpo}`
  const base = `https://wa.me/${numero}`
  if (!mensagem) return base
  return `${base}?text=${encodeURIComponent(mensagem)}`
}
