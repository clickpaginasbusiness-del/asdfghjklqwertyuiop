-- Auditoria de segurança 2026-07-05: RLS de `agendamentos` estava totalmente
-- aberta para leitura (select using (true)) — qualquer pessoa com a anon key
-- conseguia ler todos os agendamentos de todas as prestadoras (nome/telefone
-- de clientes, horários, valores). As policies de insert/update com
-- check(true)/using(true) também permitiam que qualquer um criasse ou
-- alterasse agendamentos de terceiros diretamente via client.
--
-- Toda escrita de agendamentos por clientes já passa pelas rotas de API
-- /api/agendamentos/criar e /api/agendamentos/cancelar, que usam o admin
-- client (service role) e portanto ignoram RLS. As policies abertas de
-- insert/update client-side ficaram órfãs e são removidas aqui.
drop policy if exists "Agendamentos publicos para leitura" on agendamentos;
drop policy if exists "Qualquer um pode criar agendamento" on agendamentos;
drop policy if exists "Cliente pode cancelar proprio agendamento" on agendamentos;

-- Leitura escopada: prestadora só vê os próprios agendamentos (usado pelo
-- painel). A rota pública /n/[slug] (horários ocupados, "meus agendamentos")
-- agora busca via API server-side com service role, não mais direto do client.
create policy "Prestadora le proprios agendamentos" on agendamentos for select using (
  prestadora_id in (select id from prestadoras where user_id = auth.uid())
);

-- Service role continua com acesso total (explícito, mesmo padrão já usado
-- em servicos/clientes — o service role já ignora RLS por padrão no Supabase,
-- isso só documenta a intenção).
create policy "Service role gerencia agendamentos" on agendamentos for all using (
  auth.role() = 'service_role'
) with check (
  auth.role() = 'service_role'
);

-- notificacoes: a policy de insert aceitava qualquer um (with check (true)).
-- A maior parte dos inserts já vem do admin client (rotas de agendamento),
-- mas o painel também insere notificações de auto-cancelamento direto pelo
-- client autenticado como a própria prestadora (AgendamentosClient.tsx,
-- PainelDashboardClient.tsx) — por isso a policy é escopada por prestadora_id
-- em vez de bloqueada por completo, senão essas duas telas quebram.
drop policy if exists "Sistema cria notificacoes" on notificacoes;

create policy "Prestadora insere proprias notificacoes" on notificacoes for insert with check (
  exists (select 1 from prestadoras where id = notificacoes.prestadora_id and user_id = auth.uid())
);

create policy "Service role gerencia notificacoes" on notificacoes for all using (
  auth.role() = 'service_role'
) with check (
  auth.role() = 'service_role'
);
