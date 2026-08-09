-- Presets de página pública (Clássico / Landing Page) — exclusivo dos planos
-- Studio e Studio Pro (ver src/lib/planoLimites.ts -> presets). O gate de
-- plano é aplicado em código (src/app/n/[slug]/page.tsx e
-- PersonalizarPaginaModal.tsx), não no banco — estas colunas só guardam a
-- escolha da prestadora.

ALTER TABLE prestadoras
  ADD COLUMN IF NOT EXISTS pagina_preset text DEFAULT 'classico'
  CHECK (pagina_preset IN ('classico', 'landing'));

ALTER TABLE prestadoras
  ADD COLUMN IF NOT EXISTS pagina_banner_foto_id uuid
  REFERENCES galeria(id) ON DELETE SET NULL;
