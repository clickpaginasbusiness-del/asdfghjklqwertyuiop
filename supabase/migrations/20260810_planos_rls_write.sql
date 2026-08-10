-- Corrige bug: a migration 20260809_planos_assinatura_clientes.sql habilitou
-- RLS em planos_prestadora/planos_servicos mas só criou policies de SELECT.
-- Sem policy de INSERT/UPDATE/DELETE, o Postgres nega por padrão qualquer
-- escrita feita pelo client de sessão da prestadora (usado em
-- /api/planos e /api/planos/[id]) — erro 42501 "new row violates row-level
-- security policy". Confirmado ao tentar criar um plano em produção.

-- planos_prestadora: prestadora pode criar/editar/excluir
-- seus próprios planos
CREATE POLICY "Prestadora gerencia proprios planos"
ON planos_prestadora FOR ALL USING (
  EXISTS (SELECT 1 FROM prestadoras WHERE id = planos_prestadora.prestadora_id AND user_id = auth.uid())
);

-- planos_servicos: prestadora pode gerenciar serviços
-- dos seus próprios planos
CREATE POLICY "Prestadora gerencia servicos dos proprios planos"
ON planos_servicos FOR ALL USING (
  EXISTS (
    SELECT 1 FROM planos_prestadora pp
    JOIN prestadoras p ON p.id = pp.prestadora_id
    WHERE pp.id = planos_servicos.plano_id AND p.user_id = auth.uid()
  )
);

-- planos_assinaturas e planos_usos ficam service-role only
-- para escrita (webhook MP e cron) — não adiciona policy de
-- INSERT/UPDATE/DELETE para essas duas.
