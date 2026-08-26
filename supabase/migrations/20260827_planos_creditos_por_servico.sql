-- Crédito granular por (assinatura, serviço) — corrige o modelo de pool
-- agregado (planos_assinaturas.creditos_restantes), que bloqueava um serviço
-- nunca usado só porque OUTRO serviço do mesmo plano já tinha consumido o
-- saldo compartilhado. Só se aplica a planos com planos_servicos configurado
-- (ex.: "Clube da unha", 3 manutenções + 1 alongamento + 1 esmaltação);
-- planos genéricos (sem nenhum planos_servicos) continuam 100% no modelo
-- agregado antigo — não têm linha nenhuma nesta tabela.
CREATE TABLE IF NOT EXISTS planos_assinaturas_servicos (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references planos_assinaturas(id) on delete cascade,
  servico_id uuid not null references servicos(id) on delete cascade,
  quantidade int not null,
  creditos_restantes int not null,
  created_at timestamptz not null default now(),
  unique (assinatura_id, servico_id)
);

CREATE INDEX IF NOT EXISTS idx_planos_assinaturas_servicos_assinatura ON planos_assinaturas_servicos (assinatura_id);

-- Backfill: 1 linha por (assinatura existente, serviço do plano dela).
-- creditos_restantes = quantidade - usos já registrados no ciclo atual
-- (>= periodo_inicio, mesmo corte que getCreditosPorServico já usava pra
-- exibição) — nunca negativo. Estouros passados (ex.: um serviço usado mais
-- vezes que a própria quota, por ter sobrado saldo do pool agregado) viram 0
-- restante: não tem como desfazer um serviço já prestado, então perdoamos o
-- excesso em vez de tentar registrar uma dívida.
INSERT INTO planos_assinaturas_servicos (assinatura_id, servico_id, quantidade, creditos_restantes)
SELECT pa.id, ps.servico_id, ps.quantidade,
  GREATEST(0, ps.quantidade - COALESCE(usos.total, 0))
FROM planos_assinaturas pa
JOIN planos_servicos ps ON ps.plano_id = pa.plano_id
LEFT JOIN (
  SELECT pu.assinatura_id, pu.servico_id, count(*) as total
  FROM planos_usos pu
  JOIN planos_assinaturas pa2 ON pa2.id = pu.assinatura_id
  WHERE pu.created_at >= pa2.periodo_inicio
  GROUP BY pu.assinatura_id, pu.servico_id
) usos ON usos.assinatura_id = pa.id AND usos.servico_id = ps.servico_id
ON CONFLICT (assinatura_id, servico_id) DO NOTHING;
