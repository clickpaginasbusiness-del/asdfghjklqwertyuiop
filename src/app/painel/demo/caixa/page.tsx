import { getDemoCaixaResumo } from '@/lib/demoData'
import CaixaDemoClient from './CaixaDemoClient'

export default function CaixaDemoPage() {
  return <CaixaDemoClient resumo={getDemoCaixaResumo(new Date())} />
}
