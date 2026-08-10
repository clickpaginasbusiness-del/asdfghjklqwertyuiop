-- Intervalo de almoço configurável por profissional — hoje o intervalo
-- (turno2 em horarios_funcionamento) é só por dia da semana, pro
-- estabelecimento inteiro. Isso força todas as profissionais a almoçarem no
-- mesmo horário, deixando o salão vazio. Com essas colunas, cada profissional
-- pode ter seu próprio intervalo (ex: Ana 12h-13h, Carol 13h-14h) — ver
-- generateTimeSlots em src/lib/utils.ts pra como isso é priorizado sobre o
-- turno2 do estabelecimento.
ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS intervalo_inicio time,
  ADD COLUMN IF NOT EXISTS intervalo_fim time;
