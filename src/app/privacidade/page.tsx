import type { Metadata } from 'next'
import { LegalLayout, LegalSection } from '@/components/legal/LegalLayout'
import { SITE_URL } from '@/lib/seo'

const TITLE = 'Política de Privacidade — BelleBook'
const DESCRIPTION = 'Como o BelleBook coleta, usa e protege seus dados, em conformidade com a LGPD.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/privacidade` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/privacidade`, siteName: 'BelleBook', locale: 'pt_BR', type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
}

export default function PrivacidadePage() {
  return (
    <LegalLayout title="Política de Privacidade" vigencia="21 de junho de 2026">
      <LegalSection title="1. Dados que coletamos">
        <p>Coletamos:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Nome, email e telefone;</li>
          <li>Fotos e vídeos enviados para a galeria do perfil;</li>
          <li>
            Dados de pagamento, processados diretamente pelo Stripe — nós não armazenamos número
            de cartão de crédito.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Para que usamos seus dados">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Funcionamento do serviço (agendamentos, perfil público);</li>
          <li>Cobrança das assinaturas;</li>
          <li>Comunicação, como notificações, SMS e emails;</li>
          <li>Segurança e prevenção de fraude.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Compartilhamento com terceiros">
        <p>Para operar o BelleBook, compartilhamos dados com:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-gray-800">Stripe</strong> — processamento de pagamentos;</li>
          <li><strong className="text-gray-800">Supabase</strong> — banco de dados e armazenamento, com infraestrutura no Brasil;</li>
          <li><strong className="text-gray-800">Twilio</strong> — envio de SMS para verificação por código;</li>
          <li><strong className="text-gray-800">Resend</strong> — envio de emails.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Retenção de dados">
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa, e por até 90 dias após o
          cancelamento, para fins de suporte e cumprimento de obrigações legais.
        </p>
      </LegalSection>

      <LegalSection title="5. Seus direitos (LGPD)">
        <p>
          Você pode acessar, corrigir, exportar e excluir seus dados pessoais. A exclusão da conta
          está disponível diretamente em{' '}
          <strong className="text-gray-800">Meu Perfil → Excluir conta</strong>. Para acessar,
          corrigir ou exportar seus dados, entre em contato pelo email abaixo.
        </p>
      </LegalSection>

      <LegalSection title="6. Cookies">
        <p>
          Usamos apenas cookies essenciais de sessão, necessários para manter você conectada à
          plataforma. Não usamos cookies de rastreamento ou publicidade.
        </p>
      </LegalSection>

      <LegalSection title="7. Contato do encarregado de dados (DPO)">
        <p>
          Dúvidas sobre seus dados podem ser enviadas para{' '}
          <a href="mailto:clickpaginasbusiness@gmail.com" className="text-rose-500 font-medium hover:underline">
            clickpaginasbusiness@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
