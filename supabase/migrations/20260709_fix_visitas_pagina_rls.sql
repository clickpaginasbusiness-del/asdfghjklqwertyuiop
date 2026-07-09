-- A tabela visitas_pagina está com 0 registros em produção mesmo havendo
-- agendamentos reais — a policy de insert público documentada em
-- 20260618_visitas_pagina.sql não está de fato ativa no banco (testado
-- diretamente: insert anônimo retorna 42501 "new row violates row-level
-- security policy"). Recria a policy para garantir que ela exista.
drop policy if exists "Qualquer um pode criar visita" on visitas_pagina;

create policy "Qualquer um pode criar visita" on visitas_pagina
  for insert with check (true);
