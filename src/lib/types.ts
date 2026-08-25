import type { PlanoTier } from './planoLimites'

export type Plano = PlanoTier
export type PresetPagina = 'classico' | 'landing' | 'premium'

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
  mp_customer_id: string | null
  mp_subscription_id: string | null
  mp_metodo_pagamento: 'cartao' | 'pix' | 'debito' | null
  mp_ciclo: 'mensal' | 'anual' | null
  mp_periodo_fim: string | null
  mp_pagamento_pendente_id: string | null
  cancelamento_agendado: boolean
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
  pagina_texto_agendamento: string | null
  pagina_mostrar_texto_agendamento: boolean
  pagina_mostrar_estrelas: boolean
  pagina_mostrar_avaliacoes: boolean
  pagina_mostrar_galeria: boolean
  pagina_galeria_modo: 'empilhada' | 'carrossel'
  pagina_galeria_fotos_ids: string[]
  pagina_mostrar_estabelecimento: boolean
  pagina_estabelecimento_modo: 'empilhada' | 'carrossel'
  pagina_estabelecimento_fotos_ids: string[]
  pagina_estabelecimento_titulo: string | null
  pagina_preset: PresetPagina
  pagina_banner_foto_id: string | null
  link_compartilhado_em: string | null
  created_at: string
}

/** Campos de `prestadoras` seguros pra expor em contexto público/anônimo
 * (página /n/[slug], sitemap) — exclui email, telefone, dados de pagamento
 * (mp_*), chave Pix de parceira e tudo mais que não precisa aparecer pra
 * quem não é a própria prestadora logada. Mantida com Pick<> pra nunca
 * divergir dos tipos reais das colunas que ela reaproveita. */
export type PrestadoraPublica = Pick<Prestadora,
  | 'id' | 'nome' | 'bio' | 'foto_url' | 'slug' | 'cor_tema'
  | 'whatsapp' | 'instagram' | 'endereco' | 'plano' | 'e_parceira'
  | 'hora_abertura' | 'hora_fechamento'
  | 'pagina_texto_agendamento' | 'pagina_mostrar_texto_agendamento'
  | 'pagina_mostrar_estrelas' | 'pagina_mostrar_avaliacoes' | 'pagina_mostrar_galeria'
  | 'pagina_galeria_modo' | 'pagina_galeria_fotos_ids'
  | 'pagina_mostrar_estabelecimento' | 'pagina_estabelecimento_modo'
  | 'pagina_estabelecimento_fotos_ids' | 'pagina_estabelecimento_titulo'
  | 'pagina_preset' | 'pagina_banner_foto_id'
>

export type ParceiraComissao = {
  id: string
  parceira_id: string
  indicada_id: string
  mp_payment_id: string
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
  intervalo_inicio: string | null
  intervalo_fim: string | null
  comissao_percentual: number
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
  foto_galeria_id: string | null
  aceitar_pagamento_online: boolean
  sinal_tipo: 'fixo' | 'percentual' | null
  sinal_valor: number | null
  sinal_obrigatorio: boolean
  created_at: string
}

export type PlanoPrestadora = {
  id: string
  prestadora_id: string
  nome: string
  descricao: string | null
  preco: number
  intervalo: 'mensal' | 'bimensal' | 'trimestral' | 'semestral' | 'anual'
  desconto_tipo: 'percentual' | 'fixo'
  desconto_valor: number
  creditos_acumulam: boolean
  limite_vagas: number | null
  ativo: boolean
  mp_preapproval_plan_id: string | null
  created_at: string
}

export type PlanoServico = {
  id: string
  plano_id: string
  servico_id: string
  quantidade: number
}

export type PlanoAssinatura = {
  id: string
  plano_id: string
  cliente_id: string
  prestadora_id: string
  status: 'ativa' | 'cancelada' | 'suspensa'
  mp_subscription_id: string | null
  mp_metodo: 'cartao' | 'pix' | null
  creditos_restantes: number
  creditos_totais: number
  periodo_inicio: string
  periodo_fim: string | null
  cancelado_em: string | null
  created_at: string
}

export type PlanoUso = {
  id: string
  assinatura_id: string
  agendamento_id: string | null
  servico_id: string | null
  tipo: 'automatico' | 'manual'
  descricao: string | null
  created_at: string
}

export type CaixaPrestadora = {
  id: string
  prestadora_id: string
  tipo: 'sinal' | 'pagamento_servico' | 'saque' | 'plano_assinatura'
  valor: number
  valor_bruto: number
  taxa_percentual: number
  plano_assinatura_id?: string | null
  status: 'pendente' | 'disponivel' | 'sacado' | 'reembolsado'
  agendamento_id: string | null
  mp_payment_id: string | null
  disponivel_em: string | null
  created_at: string
}

export type CaixaSaque = {
  id: string
  prestadora_id: string
  valor: number
  pix_chave: string
  status: 'solicitado' | 'pago'
  solicitado_em: string
  pago_em: string | null
  created_at: string
}

export type Cliente = {
  id: string
  nome: string
  telefone: string | null
  cliente_manual: boolean
  verificado_em: string | null
  data_nascimento: string | null
  notas: string | null
  created_at: string
}

export type Agendamento = {
  id: string
  prestadora_id: string
  profissional_id: string | null
  servico_id: string
  cliente_id: string
  data_hora: string
  status: 'confirmado' | 'cancelado' | 'concluido' | 'aguardando_pagamento'
  cancelado_por: 'prestadora' | 'cliente' | null
  arquivado: boolean
  cliente_e_prestadora: boolean
  agendamento_manual: boolean
  plano_assinatura_id?: string | null
  created_at: string
  servicos?: Servico
  clientes?: Cliente
  planos_assinaturas?: { planos_prestadora: { nome: string; desconto_tipo?: 'percentual' | 'fixo'; desconto_valor?: number } | null } | null
  prestadoras?: Prestadora
  profissionais?: Profissional
  caixa_prestadora?: { valor_bruto: number; status: string }[]
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
  tipo: 'agendamento' | 'cancelamento' | 'indicacao' | 'pagamento'
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

export type Cupom = {
  id: string
  codigo: string
  percentual: number | null
  valor_fixo: number | null
  ativo: boolean
  expira_em: string | null
  max_usos: number | null
  usos: number
  duracao_cobracas: number | null
  created_at: string
}

export type CupomUso = {
  id: string
  cupom_id: string
  prestadora_id: string
  cobracas_aplicadas: number
  created_at: string
}
