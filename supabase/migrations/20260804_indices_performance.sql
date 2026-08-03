-- Índices faltando nas queries mais quentes do app (achado em auditoria de
-- performance). Nenhuma dessas tabelas tinha índice cobrindo o padrão de
-- filtro realmente usado pelo código — toda leitura caía em sequential scan.

-- agendamentos(prestadora_id, data_hora): cobre a query mais quente do app,
-- /api/agendamentos/horarios-ocupados (chamada sem autenticação por qualquer
-- visitante escolhendo data no agendamento público, filtra prestadora_id +
-- intervalo de data_hora) e também a agenda/calendário do painel. O índice
-- existente (prestadora_id, arquivado) não ajuda esse filtro por data.
CREATE INDEX IF NOT EXISTS idx_agendamentos_prestadora_data
  ON agendamentos (prestadora_id, data_hora);

-- agendamentos(cliente_id): sem índice nenhum antes — usada em
-- /api/agendamentos/meus (histórico de agendamentos da cliente logada) e em
-- /api/clientes/[id] (checagem de cliente manual).
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente
  ON agendamentos (cliente_id);

-- notificacoes(prestadora_id, created_at): NotificacoesSino.tsx roda essa
-- query (select * ... order by created_at desc limit 30) toda vez que
-- qualquer página do /painel monta, pro sino de notificações — é uma das
-- queries mais frequentes do sistema inteiro.
CREATE INDEX IF NOT EXISTS idx_notificacoes_prestadora_created
  ON notificacoes (prestadora_id, created_at DESC);

-- avaliacoes(prestadora_id): sem índice — lida na página pública /n/[slug]
-- (toda visita), e em /painel/relatorios e /painel/perfil.
CREATE INDEX IF NOT EXISTS idx_avaliacoes_prestadora
  ON avaliacoes (prestadora_id);

-- Nota: "clientes por prestadora_id" (pedido na auditoria) não se aplica —
-- a tabela `clientes` é global (sem coluna prestadora_id; o vínculo com a
-- prestadora é sempre via agendamentos.cliente_id + agendamentos.prestadora_id,
-- já coberto pelos dois índices de agendamentos acima). O lookup direto de
-- clientes (login por telefone) já tem índice implícito via a constraint
-- UNIQUE(telefone) existente.

-- Nota: visitas_pagina(prestadora_id, created_at) já tinha índice
-- (visitas_pagina_prestadora_idx, migration 20260618) — confirmado OK, não
-- precisou de mudança.
