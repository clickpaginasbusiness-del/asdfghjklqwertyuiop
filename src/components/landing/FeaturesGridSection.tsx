import Image from 'next/image'
import { Bell, Smartphone, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'

const CLIENTES_PREVIEW = [
  {
    nome: 'Ana Clara',
    detalhe: '14 agendamentos',
    foto: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=128&h=128&fit=crop&crop=faces&q=80',
  },
  {
    nome: 'Maria Silva',
    detalhe: '9 agendamentos',
    foto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop&crop=faces&q=80',
  },
  {
    nome: 'Juliana Costa',
    detalhe: '21 agendamentos',
    foto: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=128&h=128&fit=crop&crop=faces&q=80',
  },
]

const CHART_POINTS: [number, number][] = [
  [4, 90], [45, 70], [86, 78], [127, 45], [168, 55], [209, 25], [250, 32], [276, 8],
]

/* ─── Decorações SVG ───────────────────────── */
function EllipseDecoration() {
  return (
    <svg aria-hidden className="pointer-events-none absolute -right-10 -top-10 w-44 h-44 opacity-80" viewBox="0 0 200 200" fill="none">
      <ellipse cx="140" cy="60" rx="90" ry="40" stroke="#fbcfe8" strokeWidth="1.5" transform="rotate(-18 140 60)" />
      <ellipse cx="140" cy="60" rx="65" ry="28" stroke="#f9a8d4" strokeWidth="1.5" transform="rotate(-18 140 60)" />
      <ellipse cx="140" cy="60" rx="40" ry="16" stroke="#f472b6" strokeWidth="1.5" transform="rotate(-18 140 60)" />
    </svg>
  )
}

function GrowthChart() {
  const linePath = `M${CHART_POINTS.map(([x, y]) => `${x} ${y}`).join(' L')}`
  const areaPath = `${linePath} L276 110 L4 110 Z`
  return (
    <svg aria-hidden viewBox="0 0 280 110" fill="none" className="w-full h-24">
      <defs>
        <linearGradient id="growth-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f472b6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#growth-chart-fill)" stroke="none" />
      <path d={linePath} stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {CHART_POINTS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="#fff" stroke="#f472b6" strokeWidth="2" />
      ))}
    </svg>
  )
}

function NotificationMock() {
  return (
    <div className="relative h-32 sm:h-36">
      <div className="absolute inset-x-3 top-5 bg-white rounded-xl border border-gray-100 shadow-sm h-14 opacity-60 scale-95" />
      <div className="absolute inset-x-1.5 top-2.5 bg-white rounded-xl border border-gray-100 shadow-md h-14 opacity-85 scale-[0.98]" />
      <div className="absolute inset-x-0 top-0 bg-white rounded-xl border border-pink-100 shadow-lg p-3 flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-pink-500 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-900">BelleBook</p>
            <span className="text-[10px] text-gray-400">agora</span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 leading-snug">
            Novo agendamento de Maria Silva às 14:00
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─── Seção ────────────────────────────────── */
export function FeaturesGridSection() {
  return (
    <section className="relative z-[2] bg-[#fdf5f8] px-6 py-24 rounded-t-[40px] shadow-[0_-4px_60px_rgba(0,0,0,0.04)]">
      <div className="max-w-6xl mx-auto w-full">
        <div className="text-center mb-14">
          <p data-animate className="text-pink-500 text-sm font-semibold uppercase tracking-widest mb-4">
            Funcionalidades
          </p>
          <h2 data-animate data-delay="100" className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-bold text-gray-900 leading-tight">
            Feito para o seu negócio
          </h2>
          <p data-animate data-delay="200" className="text-gray-500 mt-4 max-w-xl mx-auto">
            Cada detalhe pensado para profissionais de beleza
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
          {/* Card 1 — número de destaque */}
          <Card
            data-animate
            className="md:col-span-2 relative overflow-hidden border-pink-100 p-8 flex flex-col justify-end min-h-[220px]"
          >
            <EllipseDecoration />
            <div className="relative">
              <p className="font-serif text-5xl font-bold text-gray-900">30 dias</p>
              <p className="text-gray-500 text-sm mt-2">Grátis para começar</p>
            </div>
          </Card>

          {/* Card 2 — agendamento 24h */}
          <Card
            data-animate
            data-delay="100"
            className="md:col-span-2 border-pink-100 p-8 flex flex-col justify-between min-h-[220px]"
          >
            <div className="w-12 h-12 rounded-full bg-pink-50 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-pink-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">Agendamento 24h</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Suas clientes agendam pelo celular a qualquer hora, sem precisar te chamar no WhatsApp
              </p>
            </div>
          </Card>

          {/* Card 3 — faturamento crescendo */}
          <Card
            data-animate
            data-delay="200"
            className="md:col-span-2 border-pink-100 p-8 flex flex-col justify-between min-h-[220px]"
          >
            <GrowthChart />
            <div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">Faturamento crescendo</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Acompanhe sua receita, serviços mais vendidos e clientes em tempo real
              </p>
            </div>
          </Card>

          {/* Card 4 — notificações em tempo real */}
          <Card data-animate className="md:col-span-3 border-pink-100 p-8">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="flex-1 w-full">
                <div className="w-12 h-12 rounded-full bg-pink-50 flex items-center justify-center mb-5">
                  <Bell className="w-6 h-6 text-pink-500" />
                </div>
                <h3 className="font-semibold text-gray-900 text-lg mb-2">Notificações em tempo real</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Receba um aviso na hora que alguém agendar, confirmar ou cancelar
                </p>
              </div>
              <div className="w-full sm:w-48 shrink-0">
                <NotificationMock />
              </div>
            </div>
          </Card>

          {/* Card 5 — gestão de clientes */}
          <Card data-animate data-delay="100" className="md:col-span-3 border-pink-100 p-8">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="flex-1 w-full">
                <div className="w-12 h-12 rounded-full bg-pink-50 flex items-center justify-center mb-5">
                  <Users className="w-6 h-6 text-pink-500" />
                </div>
                <h3 className="font-semibold text-gray-900 text-lg mb-2">Gestão de clientes</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Histórico completo de cada cliente, com filtros e busca
                </p>
              </div>
              <div className="w-full sm:w-56 shrink-0 space-y-2.5">
                {CLIENTES_PREVIEW.map((c) => (
                  <div
                    key={c.nome}
                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2"
                  >
                    <Image
                      src={c.foto}
                      alt={c.nome}
                      width={36}
                      height={36}
                      className="rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.nome}</p>
                      <p className="text-xs text-gray-400 truncate">{c.detalhe}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
