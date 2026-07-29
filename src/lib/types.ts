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
  trial_pro_usado: boolean
  trial_pro_fim: string | null
  cor_tema: string | null
  mensagem_confirmacao: string | null
  mensagem_cancelamento: string | null
  mensagem_lembrete: string | null
  codigo_indicacao: string | null
  indicado_por: string | null
  indicacao_recompensa_processada: boolean
  indicacao_cadastro_processada: boolean
  last_seen_at: string | null
  e_parceira: boolean
  parceira_desde: string | null
  parceira_comissao_percentual: number | null
  parceira_periodo_30_inicio: string | null
  parceira_pix: string | null
  created_at: string
}

export type ParceiraComissao = {
  id: string
  parceira_id: string
  indicada_id: string
  stripe_invoice_id: string
  valor_assinatura: number
  percentual: number
  valor_comissao: number
  status: 'pendente' | 'disponivel' | 'pago' | 'cancelado'
  disponivel_em: string | null
  created_at: string
}

export type ParceiraSaque = {
  id: string
  parceira_id: string
  valor: number
  pix_chave: string
  status: 'solicitado' | 'pago'
  solicitado_em: string
  pago_em: string | null
  whatsapp_telefone: string | null
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
  turno2_inicio: string | null
  turno2_fim: string | null
}

export type Servico = {
  id: string
  prestadora_id: string
  nome: string
  preco: number
  duracao_minutos: number
  descricao: string | null
  ativo: boolean
  icone: string | null
  created_at: string
}

export type Cliente = {
  id: string
  nome: string
  telefone: string
  verificado_em: string | null
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
  arquivado: boolean
  cliente_e_prestadora: boolean
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
  tipo: 'agendamento' | 'cancelamento' | 'indicacao' | 'missao'
  created_at: string
}

export type Missao = {
  id: string
  titulo: string
  descricao: string
  icone: string
  desconto_percentual: number
  tipo: string
  meta_base: number
  disponivel_basico: boolean
  disponivel_pro: boolean
  ativo: boolean
  created_at: string
}

export type MissaoProgresso = {
  id: string
  prestadora_id: string
  missao_id: string
  mes: number
  ano: number
  meta_adaptada: number
  progresso: number
  concluida: boolean
  concluida_em: string | null
  desconto_aplicado: boolean
  e_bonus: boolean
  created_at: string
  missoes?: Missao
}

export type MissaoDesconto = {
  id: string
  prestadora_id: string
  percentual: number
  origem: string
  aplicado: boolean
  aplicado_em: string | null
  expira_em: string | null
  created_at: string
}

export type VisitaPagina = {
  id: string
  prestadora_id: string
  created_at: string
}

export type PushSubscriptionRow = {
  id: string
  prestadora_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  created_at: string
}

export type Avaliacao = {
  id: string
  agendamento_id: string
  prestadora_id: string
  nota: number
  comentario: string | null
  destaque: boolean
  created_at: string
  agendamentos?: { clientes: { nome: string } | null } | null
}
