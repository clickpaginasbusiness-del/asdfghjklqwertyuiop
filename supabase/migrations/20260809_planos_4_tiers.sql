-- Expande o sistema de planos de 2 (basico/pro) para 4 tiers:
-- start, pro, studio, studio_pro. Ver src/lib/planoLimites.ts pros limites
-- de cada um (profissionais, fotos, whatsapp, presets).
--
-- IMPORTANTE — ordem dos passos importa:
--   1) Renomeia os dados (basico -> start) ANTES de trocar as constraints,
--      senão a nova constraint (que não aceita mais 'basico') rejeitaria as
--      linhas existentes na hora de ser criada.
--   2) Só depois disso troca as CHECK constraints pros 4 valores novos.
--   3) Migrações de profissionais/fotos rodam por último, já assumindo os
--      dados renomeados.
--
-- Idempotente: pode rodar de novo sem duplicar efeito (UPDATEs viram no-op
-- quando não há mais linha correspondente à condição).

-- 1. Migração de dados: basico -> start (ANTES da constraint)
UPDATE prestadoras SET plano = 'start' WHERE plano = 'basico';

-- 2. Constraint de prestadoras.plano — 4 valores
ALTER TABLE prestadoras
  DROP CONSTRAINT IF EXISTS prestadoras_plano_check;
ALTER TABLE prestadoras
  ADD CONSTRAINT prestadoras_plano_check
  CHECK (plano IN ('start', 'pro', 'studio', 'studio_pro'));

-- 3. Constraint de mp_checkouts.plano — mesma coisa, senão o checkout de
-- Studio/Studio Pro quebra na hora de gravar a linha de correlação com o
-- webhook do Mercado Pago (ver src/app/api/mp/checkout/route.ts).
ALTER TABLE mp_checkouts
  DROP CONSTRAINT IF EXISTS mp_checkouts_plano_check;
ALTER TABLE mp_checkouts
  ADD CONSTRAINT mp_checkouts_plano_check
  CHECK (plano IN ('start', 'pro', 'studio', 'studio_pro'));

-- 4. Migração de profissionais: prestadoras Pro com mais de 3 profissionais
-- ativas mantêm só as 3 mais antigas ativas (limite novo do Pro, antes era
-- ilimitado). Start já tinha limite 1 desde sempre — nada a fazer ali.
-- Studio/Studio Pro são ilimitados — nada a fazer ali também.
UPDATE profissionais SET ativa = false
WHERE id NOT IN (
  SELECT id FROM profissionais p2
  WHERE p2.prestadora_id = profissionais.prestadora_id
  AND p2.ativa = true
  ORDER BY p2.created_at ASC
  LIMIT 3
)
AND prestadora_id IN (
  SELECT id FROM prestadoras WHERE plano = 'pro'
)
AND ativa = true;

-- 5. Migração de fotos da página pública — trim por plano, não um limite
-- fixo de 8 pra todo mundo: o limite do Start é 4 fotos de trabalhos e ZERO
-- fotos de estabelecimento (não 8), senão o contador em "Personalizar
-- Página" ficaria mostrando algo como "8/4" pra quem migrou de basico com
-- fotos selecionadas de um período em que foi Pro antes de um downgrade
-- (mesma classe de bug já corrigida noutro contexto — ver migration
-- 20260809_limpar_fotos_ids_orfaos.sql). Studio/Studio Pro não existem ainda
-- nesse momento da migração (tier novo), então não há o que trimar ali.

-- 5a. Start: galeria de trabalhos máx 4, estabelecimento não é permitido (0)
UPDATE prestadoras
SET pagina_galeria_fotos_ids = pagina_galeria_fotos_ids[1:4],
    pagina_estabelecimento_fotos_ids = '{}'
WHERE plano = 'start'
  AND (array_length(pagina_galeria_fotos_ids, 1) > 4
       OR array_length(pagina_estabelecimento_fotos_ids, 1) > 0);

-- 5b. Pro: galeria de trabalhos e estabelecimento máx 8 cada
UPDATE prestadoras
SET pagina_galeria_fotos_ids = pagina_galeria_fotos_ids[1:8],
    pagina_estabelecimento_fotos_ids = pagina_estabelecimento_fotos_ids[1:8]
WHERE plano = 'pro'
  AND (array_length(pagina_galeria_fotos_ids, 1) > 8
       OR array_length(pagina_estabelecimento_fotos_ids, 1) > 8);
