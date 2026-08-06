import Image from 'next/image'
import { Star } from 'lucide-react'
import { Marquee } from '@/components/ui/marquee'

interface Testimonial {
  name: string
  username: string
  body: string
  profile: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Ana Carolina',
    username: 'Nail Designer',
    body: 'Desde que comecei a usar o BelleBook, minhas clientes agendam sozinhas e eu não fico mais presa no WhatsApp. Minha agenda nunca esteve tão organizada!',
    profile: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=96&h=96&fit=crop&crop=face&q=80',
  },
  {
    name: 'Fernanda Lima',
    username: 'Manicure',
    body: 'Em 2 semanas com o BelleBook já tinha o dobro de agendamentos. As clientes adoram poder escolher o horário na hora que querem, mesmo de madrugada!',
    profile: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=face&q=80',
  },
  {
    name: 'Juliana Costa',
    username: 'Cabeleireira',
    body: 'O relatório financeiro me mostrou que eu estava cobrando barato em alguns serviços. Agora tenho controle total do meu faturamento.',
    profile: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=96&h=96&fit=crop&crop=face&q=80',
  },
  {
    name: 'Beatriz Santos',
    username: 'Designer de Sobrancelhas',
    body: 'Minha página ficou incrível! As clientes me chamam dizendo que parece um salão famoso. Os cancelamentos diminuíram muito com os lembretes automáticos.',
    profile: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=96&h=96&fit=crop&crop=face&q=80',
  },
  {
    name: 'Camila Oliveira',
    username: 'Lash Designer',
    body: 'Antes eu ficava horas respondendo mensagens. Agora o BelleBook faz tudo isso por mim e consigo atender muito mais clientes por dia.',
    profile: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=96&h=96&fit=crop&crop=face&q=80',
  },
  {
    name: 'Larissa Ferreira',
    username: 'Esteticista',
    body: 'O sistema de avaliações me ajudou a construir reputação online. Clientes novas chegam todo dia pelo meu link de agendamento.',
    profile: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=96&h=96&fit=crop&crop=face&q=80',
  },
  {
    name: 'Patricia Mendes',
    username: 'Maquiadora',
    body: 'Consegui organizar minha equipe toda no BelleBook. Cada profissional tem seus próprios horários e as clientes escolhem com quem querem ser atendidas.',
    profile: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=96&h=96&fit=crop&crop=face&q=80',
  },
  {
    name: 'Vanessa Rocha',
    username: 'Depiladora',
    body: '30 dias grátis e já me convenci. Não consigo mais imaginar meu negócio sem o BelleBook. Vale muito mais do que pago por mês.',
    profile: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=96&h=96&fit=crop&crop=face&q=80',
  },
]

const FILEIRA_1 = TESTIMONIALS.slice(0, 4)
const FILEIRA_2 = TESTIMONIALS.slice(4, 8)

function TestimonialCard({ name, username, body, profile }: Testimonial) {
  return (
    <figure className="w-80 shrink-0 rounded-2xl border border-pink-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-3">
        <Image
          src={profile}
          alt={name}
          width={40}
          height={40}
          className="rounded-full object-cover shrink-0"
        />
        <div className="min-w-0">
          <figcaption className="text-sm font-semibold text-gray-900 truncate">{name}</figcaption>
          <p className="text-xs text-rose-400 truncate">{username}</p>
        </div>
      </div>
      <div className="flex gap-0.5 mt-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
        ))}
      </div>
      <blockquote className="mt-3 text-sm text-gray-600 leading-relaxed">{body}</blockquote>
    </figure>
  )
}

export function TestimonialsMarqueeSection() {
  return (
    <section
      id="depoimentos"
      className="relative z-[2] bg-[#0f0f0f] min-h-screen flex flex-col items-center justify-center px-6 py-24 rounded-t-[40px] overflow-hidden"
    >
      {/* Subtle glow */}
      <div aria-hidden className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-rose-500/10 blur-3xl" />

      <div className="relative max-w-3xl mx-auto w-full text-center mb-16">
        <p data-animate className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-4">
          Depoimentos
        </p>
        <h2 data-animate data-delay="100" className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-bold text-white leading-tight">
          O que dizem as profissionais
        </h2>
      </div>

      <div data-animate data-delay="200" className="relative w-full max-w-6xl mx-auto flex flex-col gap-6">
        <Marquee pauseOnHover className="[--marquee-duration:25s] py-1">
          {FILEIRA_1.map((t) => (
            <TestimonialCard key={t.name} {...t} />
          ))}
        </Marquee>
        <Marquee reverse pauseOnHover className="[--marquee-duration:25s] py-1">
          {FILEIRA_2.map((t) => (
            <TestimonialCard key={t.name} {...t} />
          ))}
        </Marquee>

        {/* Fade nas bordas */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-32 bg-gradient-to-r from-[#0f0f0f] to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-32 bg-gradient-to-l from-[#0f0f0f] to-transparent" />
      </div>
    </section>
  )
}
