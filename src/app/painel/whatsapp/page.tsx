import { MessageCircle, Bell, Cake, CalendarClock, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'WhatsApp Automático — BelleBook' }

const USOS = [
  { icon: CalendarClock, texto: 'Confirmações automáticas assim que a cliente agenda' },
  { icon: Bell, texto: 'Lembretes na véspera do atendimento, sem precisar mandar na mão' },
  { icon: Cake, texto: 'Mensagens de aniversário pra fidelizar suas clientes' },
  { icon: Sparkles, texto: 'E muito mais — vamos anunciar cada novidade por aqui' },
]

export default function WhatsAppAutomaticoPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">WhatsApp Automático</h1>
        <span className="text-[10px] font-bold text-white bg-green-800 px-2 py-0.5 rounded-full tracking-wide">
          EM BREVE
        </span>
      </div>

      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-green-800">O que está vindo por aqui</p>
              <p className="text-xs text-green-700 mt-2 leading-relaxed">
                Em breve você poderá conectar seu WhatsApp ao BelleBook e enviar mensagens automáticas para suas clientes — confirmações de agendamento, lembretes, mensagens de aniversário e muito mais.
              </p>
              <p className="text-xs text-green-700 mt-2 leading-relaxed">
                Estamos desenvolvendo essa funcionalidade para os planos Pro e Studio. Fique de olho nas novidades!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>O que vai dar pra fazer</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100">
          {USOS.map(({ icon: Icon, texto }, i) => (
            <div key={i} className={`flex items-center gap-3 ${i === 0 ? 'pb-3' : i === USOS.length - 1 ? 'pt-3' : 'py-3'}`}>
              <Icon className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-sm text-gray-700">{texto}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <p className="text-sm font-semibold text-green-800">Quais planos vão ter acesso</p>
          <p className="text-xs text-green-700 mt-2 leading-relaxed">
            O WhatsApp Automático está sendo desenvolvido para os planos <strong>Pro</strong> e <strong>Studio</strong>. Essa página é só uma prévia — disponível pra todo mundo consultar, mesmo antes do lançamento.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
