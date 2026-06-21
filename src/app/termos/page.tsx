import type { Metadata } from 'next'
import { LegalLayout, LegalSection } from '@/components/legal/LegalLayout'
import { SITE_URL } from '@/lib/seo'

const TITLE = 'Termos de Uso — BelleBook'
const DESCRIPTION = 'Termos de Uso da plataforma BelleBook — planos, pagamento, cancelamento e responsabilidades.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/termos` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/termos`, siteName: 'BelleBook', locale: 'pt_BR', type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
}

export default function TermosPage() {
  return (
    <LegalLayout title="Termos de Uso" vigencia="21 de junho de 2026">
      <LegalSection title="1. Sobre o BelleBook">
        <p>
          O BelleBook é uma plataforma de agendamento online para profissionais de beleza
          (&quot;prestadoras&quot;) e seus clientes. Ao criar uma conta ou usar o serviço, você concorda
          com estes Termos de Uso e com a nossa{' '}
          <a href="/privacidade" className="text-rose-500 font-medium hover:underline">
            Política de Privacidade
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Quem pode usar o BelleBook">
        <p>
          <strong className="text-gray-800">Prestadoras</strong> precisam ter 18 anos ou mais para
          criar uma conta e oferecer serviços na plataforma.
        </p>
        <p>
          <strong className="text-gray-800">Clientes</strong> podem agendar livremente a partir dos
          13 anos. Clientes menores de 18 anos precisam de autorização dos pais ou responsáveis
          legais para usar a plataforma.
        </p>
      </LegalSection>

      <LegalSection title="3. Planos e pagamento">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Plano Básico: R$ 49/mês.</li>
          <li>Plano Pro: R$ 89/mês.</li>
          <li>Período de teste gratuito de 30 dias, sem necessidade de cartão de crédito.</li>
          <li>
            Os pagamentos são processados pelo Stripe, com renovação automática mensal ou anual,
            de acordo com o plano escolhido.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Cancelamento e reembolso">
        <p>
          Você pode cancelar sua assinatura a qualquer momento, sem multa. Após o cancelamento, o
          acesso à plataforma continua disponível até o fim do período já pago.
        </p>
        <p>Não há reembolso de períodos já pagos.</p>
      </LegalSection>

      <LegalSection title="5. Responsabilidades">
        <p>
          O BelleBook é uma ferramenta de agendamento e gestão. Não somos parte da relação entre
          prestadora e cliente e não nos responsabilizamos por conflitos, pela qualidade dos
          serviços prestados ou por questões financeiras entre as partes.
        </p>
        <p>
          Contas podem ser suspensas em caso de uso indevido, fraude, ou violação destes Termos de
          Uso.
        </p>
      </LegalSection>

      <LegalSection title="6. Alterações destes termos">
        <p>
          Podemos atualizar estes Termos de Uso periodicamente. A versão vigente estará sempre
          disponível nesta página, com a data de atualização indicada no topo.
        </p>
      </LegalSection>

      <LegalSection title="7. Contato">
        <p>
          Dúvidas sobre estes termos podem ser enviadas para{' '}
          <a href="mailto:clickpaginasbusiness@gmail.com" className="text-rose-500 font-medium hover:underline">
            clickpaginasbusiness@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
