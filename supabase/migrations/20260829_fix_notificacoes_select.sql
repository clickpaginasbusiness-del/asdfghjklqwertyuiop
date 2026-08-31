-- Corrige item critico da auditoria: a policy de SELECT em notificacoes
-- ("notificacoes_select_proprio_user") checa user_id = auth.uid(), mas a
-- tabela notificacoes nao tem coluna user_id (so prestadora_id) -- todo
-- INSERT no codigo (10 ocorrencias conferidas) grava prestadora_id, nunca
-- user_id. Resultado: essa policy nunca bate com nada, pra ninguem, e o
-- sininho de notificacoes fica sempre vazio.
--
-- Nao remove a policy quebrada (nao faz mal nenhum ficar, RLS permissive e'
-- OR entre policies do mesmo comando) -- so adiciona a policy que faltava,
-- no mesmo padrao ja usado pelas policies de UPDATE/DELETE dessa mesma
-- tabela (prestadora_id -> prestadoras.user_id = auth.uid()).

create policy "Prestadora le proprias notificacoes" on notificacoes
  for select using (
    exists (select 1 from prestadoras where id = notificacoes.prestadora_id and user_id = auth.uid())
  );
