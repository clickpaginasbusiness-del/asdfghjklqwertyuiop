-- Sistema de Missões/Objetivos mensais com desconto na assinatura.

-- 1. Catálogo de missões disponíveis (templates compartilhados entre todas as
-- prestadoras, não é uma tabela por-prestadora).
CREATE TABLE IF NOT EXISTS missoes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo text NOT NULL,
  descricao text NOT NULL,
  icone text NOT NULL DEFAULT 'Target',
  desconto_percentual smallint NOT NULL DEFAULT 10,
  -- UNIQUE além do NOT NULL do pedido original: cada tipo aparece uma única
  -- vez no catálogo, isso permite ON CONFLICT (tipo) no seed (idempotente,
  -- pode rodar o INSERT de novo sem duplicar linhas).
  tipo text NOT NULL UNIQUE,
  meta_base integer NOT NULL,
  disponivel_basico boolean DEFAULT true,
  disponivel_pro boolean DEFAULT true,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Progresso mensal de cada prestadora em cada missão sorteada.
CREATE TABLE IF NOT EXISTS missoes_progresso (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestadora_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE,
  missao_id uuid REFERENCES missoes(id) ON DELETE CASCADE,
  mes integer NOT NULL,
  ano integer NOT NULL,
  meta_adaptada integer NOT NULL,
  progresso integer DEFAULT 0,
  concluida boolean DEFAULT false,
  concluida_em timestamptz,
  desconto_aplicado boolean DEFAULT false,
  e_bonus boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(prestadora_id, missao_id, mes, ano)
);

CREATE INDEX IF NOT EXISTS idx_missoes_progresso_mes ON missoes_progresso (prestadora_id, ano, mes);

-- 3. Fila de descontos ganhos, aplicados na próxima fatura via webhook do Stripe.
CREATE TABLE IF NOT EXISTS missoes_descontos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestadora_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE,
  percentual smallint NOT NULL,
  origem text NOT NULL,
  aplicado boolean DEFAULT false,
  aplicado_em timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missoes_descontos_pendentes ON missoes_descontos (prestadora_id) WHERE aplicado = false;

-- 4. NÃO fazia parte do pedido original, mas é indispensável: hoje o envio de
-- lembrete/confirmação por WhatsApp é só um link wa.me aberto no navegador da
-- prestadora — não fica nenhum registro em lugar nenhum. Sem uma tabela pra
-- registrar esse clique, as missões 'lembretes' e 'confirmacoes' nunca teriam
-- como progredir. Guarda um evento por envio, usado só pra contar clientes
-- distintos por missão/mês (o "cooldown por cliente" cai de graça: contar
-- distinct cliente_id já evita contar o mesmo cliente 2x).
CREATE TABLE IF NOT EXISTS missoes_eventos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestadora_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('lembrete', 'confirmacao')),
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  agendamento_id uuid REFERENCES agendamentos(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missoes_eventos_busca ON missoes_eventos (prestadora_id, tipo, created_at);

-- Permite notificar no sininho quando uma missão é concluída ("🎯 Missão
-- concluída!..."). Mesmo padrão já usado pra liberar o tipo 'indicacao'.
ALTER TABLE notificacoes DROP CONSTRAINT IF EXISTS notificacoes_tipo_check;
ALTER TABLE notificacoes ADD CONSTRAINT notificacoes_tipo_check
  CHECK (tipo IN ('agendamento', 'cancelamento', 'indicacao', 'missao'));

-- RLS — leitura própria (toda escrita passa pelo service role nas rotas de API).
ALTER TABLE missoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE missoes_progresso ENABLE ROW LEVEL SECURITY;
ALTER TABLE missoes_descontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE missoes_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Missoes publicas para leitura" ON missoes;
CREATE POLICY "Missoes publicas para leitura" ON missoes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Prestadora ve seu proprio progresso" ON missoes_progresso;
CREATE POLICY "Prestadora ve seu proprio progresso" ON missoes_progresso FOR SELECT USING (
  EXISTS (SELECT 1 FROM prestadoras WHERE id = missoes_progresso.prestadora_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Prestadora ve seus proprios descontos" ON missoes_descontos;
CREATE POLICY "Prestadora ve seus proprios descontos" ON missoes_descontos FOR SELECT USING (
  EXISTS (SELECT 1 FROM prestadoras WHERE id = missoes_descontos.prestadora_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Prestadora ve seus proprios eventos" ON missoes_eventos;
CREATE POLICY "Prestadora ve seus proprios eventos" ON missoes_eventos FOR SELECT USING (
  EXISTS (SELECT 1 FROM prestadoras WHERE id = missoes_eventos.prestadora_id AND user_id = auth.uid())
);
