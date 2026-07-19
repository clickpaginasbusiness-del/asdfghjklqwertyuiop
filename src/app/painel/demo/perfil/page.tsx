import { UserCircle } from 'lucide-react'
import { DemoPlaceholderPage } from '../DemoPlaceholderPage'

export default function PerfilDemoPage() {
  return (
    <DemoPlaceholderPage
      titulo="Meu Perfil"
      icon={UserCircle}
      descricao="No plano real, você edita sua foto, bio, endereço e link personalizado da sua página pública."
    />
  )
}
