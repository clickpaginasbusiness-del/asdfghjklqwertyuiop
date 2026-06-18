import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

export function formatDate(date: string | Date | null | undefined): string {
  const d = parseDate(date)
  return d ? format(d, 'dd/MM/yyyy', { locale: ptBR }) : '—'
}

export function formatDateTime(date: string | Date | null | undefined): string {
  const d = parseDate(date)
  return d ? format(d, "dd/MM/yyyy 'às' HH'h'mm", { locale: ptBR }) : '—'
}

export function formatDateShort(date: string | Date | null | undefined): string {
  const d = parseDate(date)
  return d ? format(d, "dd/MM 'às' HH'h'mm", { locale: ptBR }) : '—'
}

export function formatTime(date: string | Date | null | undefined): string {
  const d = parseDate(date)
  return d ? format(d, 'HH:mm', { locale: ptBR }) : '—'
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

export function buildWhatsappUrl(telefone: string, mensagem?: string): string {
  const limpo = cleanTelefone(telefone)
  const numero = limpo.startsWith('55') ? limpo : `55${limpo}`
  const base = `https://wa.me/${numero}`
  if (!mensagem) return base
  return `${base}?text=${encodeURIComponent(mensagem)}`
}
