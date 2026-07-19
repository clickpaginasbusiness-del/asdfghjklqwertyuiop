import ServicosDemoClient from './ServicosDemoClient'
import { DEMO_SERVICOS, DEMO_PROFISSIONAIS } from '@/lib/demoData'

export default function ServicosDemoPage() {
  const servicos = DEMO_SERVICOS.map((s) => ({ ...s, servico_profissionais: [] }))

  return (
    <ServicosDemoClient
      servicos={servicos}
      profissionais={DEMO_PROFISSIONAIS.map((p) => ({ id: p.id, nome: p.nome }))}
    />
  )
}
