-- Remove a policy de insert aberta que permitia qualquer pessoa (anon)
-- inserir avaliações sem autenticação — brecha que possibilitava reviews
-- falsas para qualquer agendamento cujo UUID fosse conhecido.
-- O insert agora é feito exclusivamente via API route /api/avaliacoes/criar
-- que usa o admin client (service role), o qual ignora RLS por design.
DROP POLICY IF EXISTS "Cliente pode criar avaliacao" ON avaliacoes;
