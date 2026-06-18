'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Headset, MessageCircle, Mail, ChevronDown } from 'lucide-react'
import { buildWhatsappUrl } from '@/lib/utils'
import toast from 'react-hot-toast'

const SUPORTE_WHATSAPP = '5531971192930'
const SUPORTE_EMAIL = 'clickpaginasbusiness@gmail.com'

const FAQ = [
  {
    pergunta: 'Como configurar meus horários de atendimento?',
    resposta: 'Acesse o menu "Horários", defina os dias e horários em que você atende e salve. Você também pode bloquear datas específicas (folgas, feriados) na mesma página.',
    link: { href: '/painel/horarios', label: 'Ir para Horários' },
  },
  {
    pergunta: 'Como adicionar profissionais à minha equipe?',
    resposta: 'Acesse o menu "Profissionais" e clique em adicionar. No Plano Básico você pode cadastrar 1 profissional; no Plano Pro o número é ilimitado.',
    link: { href: '/painel/profissionais', label: 'Ir para Profissionais' },
  },
  {
    pergunta: 'Como compartilhar meu link de agendamento?',
    resposta: 'Seu link público fica em "Meu Perfil", na seção "Seu link público". Copie e compartilhe no WhatsApp, Instagram ou onde preferir — suas clientes agendam direto por ele.',
    link: { href: '/painel/perfil', label: 'Ir para Meu Perfil' },
  },
  {
    pergunta: 'Como cancelar minha assinatura?',
    resposta: 'Acesse o menu "Assinatura" e clique em "Gerenciar assinatura". Você será levada ao portal seguro da Stripe, onde pode cancelar, trocar o cartão ou ver faturas.',
    link: { href: '/painel/assinatura', label: 'Ir para Assinatura' },
  },
]

export default function SuporteClient({ nome, email }: { nome: string; email: string }) {
  const [mensagem, setMensagem] = useState('')
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const whatsappUrl = buildWhatsappUrl(
    SUPORTE_WHATSAPP,
    `Olá! Sou ${nome} (${email}) e preciso de ajuda com o BelleBook.`
  )

  function enviarEmail() {
    if (!mensagem.trim()) {
      toast.error('Escreva sua mensagem antes de enviar')
      return
    }
    const subject = `Suporte BelleBook — ${nome}`
    const body = `Mensagem de ${nome} (${email}):\n\n${mensagem}`
    window.location.href = `mailto:${SUPORTE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Headset className="w-6 h-6 text-rose-400" />
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Suporte</h1>
      </div>

      {/* WhatsApp */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-rose-400" />
            <CardTitle>Fale com a gente no WhatsApp</CardTitle>
          </div>
          <p className="text-sm text-gray-400">Resposta rápida para dúvidas e problemas do dia a dia</p>
        </CardHeader>
        <CardContent>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Button className="gap-2 bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-300">
              <MessageCircle className="w-4 h-4" />
              Abrir conversa no WhatsApp
            </Button>
          </a>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-rose-400" />
            <CardTitle>Enviar mensagem por email</CardTitle>
          </div>
          <p className="text-sm text-gray-400">Escreva sua mensagem — abriremos seu app de email para você enviar para {SUPORTE_EMAIL}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Descreva sua dúvida ou problema..."
            rows={4}
          />
          <Button onClick={enviarEmail} variant="outline" className="gap-2">
            <Mail className="w-4 h-4" />
            Enviar por email
          </Button>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>Perguntas frequentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {FAQ.map((item, i) => {
            const open = openIndex === i
            return (
              <div key={item.pergunta} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenIndex(open ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors"
                >
                  {item.pergunta}
                  <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="px-4 pb-4 text-sm text-gray-500 space-y-2">
                    <p>{item.resposta}</p>
                    <Link href={item.link.href} className="inline-block text-rose-500 font-semibold hover:text-rose-600 transition-colors">
                      {item.link.label} →
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
