-- Terceiro preset de página pública: Premium (tema escuro/dourado) —
-- também exclusivo dos planos Studio e Studio Pro, mesmo gate dos presets
-- existentes (ver src/lib/planoLimites.ts -> presets).

ALTER TABLE prestadoras
  DROP CONSTRAINT IF EXISTS prestadoras_pagina_preset_check;
ALTER TABLE prestadoras
  ADD CONSTRAINT prestadoras_pagina_preset_check
  CHECK (pagina_preset IN ('classico', 'landing', 'premium'));
