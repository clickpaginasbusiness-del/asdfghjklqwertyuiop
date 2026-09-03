-- Corrige item importante da auditoria: renovacao Pix de plano de cliente
-- podia gerar multiplos links de cobranca pro mesmo ciclo -- o bloco de
-- renovacao Pix da PRESTADORA (mesmo arquivo, cron/mp-renovacoes) ja checa
-- mp_pagamento_pendente_id antes de gerar nova cobranca; o bloco equivalente
-- pra planos_assinaturas (assinatura de CLIENTE) nao tinha coluna nenhuma
-- pra isso. Mesmo padrao aplicado aqui.

ALTER TABLE planos_assinaturas ADD COLUMN IF NOT EXISTS mp_pagamento_pendente_id text;
