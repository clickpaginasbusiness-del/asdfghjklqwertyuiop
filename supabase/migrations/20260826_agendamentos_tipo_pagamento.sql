-- Fase 5 (Planos de Assinatura): persiste o modo de pagamento escolhido pela
-- cliente (sinal vs. valor completo) quando o serviço tem sinal_obrigatorio.
-- Nullable: agendamentos criados antes desta migration ficam com o valor
-- null, e o código novo (pagar/route.ts, checkout/page.tsx, webhook do MP)
-- cai de volta no comportamento antigo (baseado em servico.sinal_obrigatorio
-- e na heurística de valor) quando encontra null.
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS tipo_pagamento text CHECK (tipo_pagamento IN ('sinal', 'completo'));
