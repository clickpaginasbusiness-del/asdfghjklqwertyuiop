-- Permite que o painel (Meu Perfil) reflita em tempo real quando a recompensa
-- de indicação é processada pelo webhook do Stripe (trial estendido / pausa
-- de cobrança), sem precisar recarregar a página.
alter publication supabase_realtime add table prestadoras;
