import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { parseISO, isValid } from 'date-fns'
import type { HorarioFuncionamento } from '@/lib/types'

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

/** Formata um horário-de-dia bruto ('HH:mm' ou 'HH:mm:ss', ex.: de
 * horarios_funcionamento) pro formato compacto usado na página pública —
 * "9h" quando os minutos são zero, "9h30" caso contrário. Diferente de
 * formatTime/formatDateShort acima: opera direto na string, sem Date/fuso,
 * porque o valor já é só um horário-de-dia (sem data associada). */
export function formatHora(h: string): string {
  const [hora, min] = h.split(':')
  return min === '00' ? `${parseInt(hora)}h` : `${parseInt(hora)}h${min}`
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

/** Mês (1-12) e ano atuais, calculados em horário de São Paulo (não no fuso do runtime). */
export function mesAnoAtualSP(): { mes: number; ano: number } {
  const { MM, yyyy } = partesDataSP(new Date())
  return { mes: Number(MM), ano: Number(yyyy) }
}

/** Início (inclusivo) e fim (exclusivo) de um mês, como instantes de meia-noite em São Paulo. */
export function limitesDoMesSP(mes: number, ano: number): { inicio: Date; fim: Date } {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1, 3, 0, 0))
  const fim = mes === 12
    ? new Date(Date.UTC(ano + 1, 0, 1, 3, 0, 0))
    : new Date(Date.UTC(ano, mes, 1, 3, 0, 0))
  return { inicio, fim }
}

/** Mês/ano imediatamente anterior a um mês/ano de referência (com virada de ano). */
export function mesAnteriorSP(mes: number, ano: number): { mes: number; ano: number } {
  return mes === 1 ? { mes: 12, ano: ano - 1 } : { mes: mes - 1, ano }
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

function slotsDaJanela(inicio: string, fim: string, duracaoMinutos: number): string[] {
  const slots: string[] = []
  const [startH, startM] = inicio.split(':').map(Number)
  const [endH, endM] = fim.split(':').map(Number)

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

/** turno2Inicio/turno2Fim são opcionais — quando presentes, geram um segundo
 * bloco de horários (ex: turno da tarde), pulando o intervalo entre os turnos. */
export function generateTimeSlots(
  horaAbertura: string,
  horaFechamento: string,
  duracaoMinutos: number,
  turno2Inicio?: string | null,
  turno2Fim?: string | null
): string[] {
  const slots = slotsDaJanela(horaAbertura, horaFechamento, duracaoMinutos)
  if (turno2Inicio && turno2Fim) {
    slots.push(...slotsDaJanela(turno2Inicio, turno2Fim, duracaoMinutos))
  }
  return slots
}

export interface HorasDoDia {
  abertura: string
  fechamento: string
  turno2Inicio: string | null
  turno2Fim: string | null
}

interface ProfissionalHorarioLike {
  hora_abertura: string | null
  hora_fechamento: string | null
  dias_semana: number[] | null
  intervalo_inicio?: string | null
  intervalo_fim?: string | null
}

/** Lógica única de disponibilidade compartilhada entre a página pública
 * (/n/[slug]) e o agendamento manual do painel — qualquer ajuste aqui vale
 * pros dois fluxos, em vez de duas implementações que podem divergir. */

/** Janela de horário (+ intervalo de almoço) de um dia específico. Se a
 * profissional tiver horário próprio configurado, ele substitui a janela do
 * dia inteiro — e nesse caso o intervalo de almoço da prestadora não se
 * aplica, já que a agenda dela já é um recorte específico do dia. O
 * intervalo de almoço PRÓPRIO da profissional (intervalo_inicio/fim), por
 * outro lado, sempre tem prioridade sobre o do estabelecimento, mesmo
 * quando ela usa o horário de funcionamento padrão — é o que permite Ana
 * almoçar 12h-13h e Carol 13h-14h sem duas profissionais com hora_abertura
 * customizada. */
export function computeHorasDoDia(
  diaSemana: number,
  horariosFuncionamento: HorarioFuncionamento[],
  profissional: ProfissionalHorarioLike | null,
  prestadoraHoraAbertura: string,
  prestadoraHoraFechamento: string
): HorasDoDia {
  const horario = horariosFuncionamento.find((h) => h.dia_semana === diaSemana)
  const temHorarioProprio = Boolean(profissional?.hora_abertura && profissional?.hora_fechamento)
  const temIntervaloProprio = Boolean(profissional?.intervalo_inicio && profissional?.intervalo_fim)
  return {
    abertura: profissional?.hora_abertura ?? horario?.hora_abertura ?? prestadoraHoraAbertura,
    fechamento: profissional?.hora_fechamento ?? horario?.hora_fechamento ?? prestadoraHoraFechamento,
    turno2Inicio: temIntervaloProprio ? profissional!.intervalo_inicio! : temHorarioProprio ? null : horario?.turno2_inicio ?? null,
    turno2Fim: temIntervaloProprio ? profissional!.intervalo_fim! : temHorarioProprio ? null : horario?.turno2_fim ?? null,
  }
}

/** Um dia está indisponível pra agendar se: está bloqueado explicitamente, o
 * dia da semana está desativado no horário de funcionamento (ou seria
 * desativado por padrão, se a prestadora nunca configurou Horários), ou a
 * profissional selecionada não atende nesse dia da semana. */
export function diaIndisponivelParaAgendar(
  diaSemana: number,
  dataChave: string,
  diasBloqueados: string[],
  horariosFuncionamento: HorarioFuncionamento[],
  profissional: ProfissionalHorarioLike | null
): boolean {
  if (diasBloqueados.includes(dataChave)) return true
  const horario = horariosFuncionamento.find((h) => h.dia_semana === diaSemana)
  const ativo = horario ? horario.ativo : diaAtivoPadrao(diaSemana)
  if (!ativo) return true
  if (profissional?.dias_semana && !profissional.dias_semana.includes(diaSemana)) return true
  return false
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

/**
 * Normaliza um telefone pros dígitos locais (DDD + número), removendo o DDI
 * 55 quando presente. Precisa desse passo extra porque clientes.telefone é
 * salvo só com dígitos locais e prestadoras.telefone é salvo em E.164
 * (+55DDD...) — sem normalizar os dois pro mesmo formato, a comparação
 * direta nunca bate mesmo quando é o mesmo número.
 */
export function telefoneLocal(value: string | null | undefined): string {
  const digits = cleanTelefone(value ?? '')
  return digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits
}

/** Compara dois telefones ignorando formatação/DDI. Vazio nunca "bate" com vazio. */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = telefoneLocal(a)
  const nb = telefoneLocal(b)
  return na.length > 0 && na === nb
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
