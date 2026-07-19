import ProfissionaisDemoClient from './ProfissionaisDemoClient'
import { DEMO_PROFISSIONAIS } from '@/lib/demoData'

export default function ProfissionaisDemoPage() {
  return <ProfissionaisDemoClient profissionais={DEMO_PROFISSIONAIS} />
}
