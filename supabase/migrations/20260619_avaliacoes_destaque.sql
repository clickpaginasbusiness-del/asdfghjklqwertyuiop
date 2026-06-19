-- Avaliações em destaque (exclusivo Plano Pro) — curadoria para a seção
-- "O que dizem sobre mim" da página pública.
ALTER TABLE avaliacoes
  ADD COLUMN IF NOT EXISTS destaque boolean NOT NULL DEFAULT false;

-- Permite que a prestadora marque/desmarque destaque nas próprias avaliações
CREATE POLICY "Prestadora atualiza destaque das proprias avaliacoes" ON avaliacoes FOR UPDATE USING (
  exists (select 1 from prestadoras where id = avaliacoes.prestadora_id and user_id = auth.uid())
);
