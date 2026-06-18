export type Plano = 'basico' | 'pro'

export type Prestadora = {
  id: string
  user_id: string
  nome: string
  email: string
  slug: string
  bio: string | null
  foto_url: string | null
  hora_abertura: string
  hora_fechamento: string
  whatsapp: string | null
  instagram: string | null
  endereco: string | null
  telefone: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plano: Plano | null
  assinatura_ativa: boolean
  trial_fim: string | null
  e_trial: boolean
  downgrade_aviso: boolean
  created_at: string
}

export type Profissional = {
  id: string
  prestadora_id: string
  nome: string
  foto_url: string | null
  bio: string | null
  ativa: boolean
  dias_semana: number[] | null
  hora_abertura: string | null
  hora_fechamento: string | null
  created_at: string
}

export type HorarioFuncionamento = {
  id: string
  prestadora_id: string
  dia_semana: number  // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  ativo: boolean
  hora_abertura: string
  hora_fechamento: string
}

export type Servico = {
  id: string
  prestadora_id: string
  nome: string
  preco: number
  duracao_minutos: number
  descricao: string | null
  ativo: boolean
  created_at: string
}

export type Cliente = {
  id: string
  nome: string
  telefone: string
  created_at: string
}

export type Agendamento = {
  id: string
  prestadora_id: string
  profissional_id: string | null
  servico_id: string
  cliente_id: string
  data_hora: string
  status: 'confirmado' | 'cancelado' | 'concluido'
  cancelado_por: 'prestadora' | 'cliente' | null
  created_at: string
  servicos?: Servico
  clientes?: Cliente
  prestadoras?: Prestadora
  profissionais?: Profissional
}

export type GaleriaItem = {
  id: string
  prestadora_id: string
  url: string
  tipo: 'imagem' | 'video'
  created_at: string
}

export type DiaBloqueado = {
  id: string
  prestadora_id: string
  data: string
  motivo: string | null
}

export type Notificacao = {
  id: string
  prestadora_id: string
  mensagem: string
  lida: boolean
  tipo: 'agendamento' | 'cancelamento'
  created_at: string
}

export type VisitaPagina = {
  id: string
  prestadora_id: string
  created_at: string
}
