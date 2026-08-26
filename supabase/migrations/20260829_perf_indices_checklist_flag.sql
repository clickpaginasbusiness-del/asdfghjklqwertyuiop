-- Fase 1 do diagnóstico de performance do painel: índices faltando nas
-- colunas usadas pelos joins/filtros mais pesados (caixa_prestadora cresce
-- pra sempre, e o join novo caixa_prestadora(valor_bruto, status) em
-- agendamentos ficou sem índice na FK).
CREATE INDEX IF NOT EXISTS idx_caixa_prestadora_agendamento ON caixa_prestadora (agendamento_id);
CREATE INDEX IF NOT EXISTS idx_caixa_prestadora_plano_assinatura ON caixa_prestadora (plano_assinatura_id);
CREATE INDEX IF NOT EXISTS idx_planos_assinaturas_plano ON planos_assinaturas (plano_id);

-- Fase 2: painel/layout.tsx rodava getChecklistStatus (3 queries de
-- contagem) em toda navegação, mesmo pra prestadora que já completou o
-- checklist há muito tempo. Uma vez completo, fica registrado aqui — daí
-- pra frente getChecklistStatus nem consulta mais nada, só lê essa coluna
-- (já vem junto no select('*') que o layout já faz).
ALTER TABLE prestadoras ADD COLUMN IF NOT EXISTS checklist_completo boolean NOT NULL DEFAULT false;
