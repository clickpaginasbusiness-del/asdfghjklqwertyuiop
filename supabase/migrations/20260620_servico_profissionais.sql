-- Quais profissionais realizam cada serviço. Se um serviço não tiver nenhuma
-- linha aqui, ele é considerado oferecido por todas as profissionais (comportamento
-- atual, mantido como padrão para não quebrar serviços já cadastrados).
CREATE TABLE IF NOT EXISTS servico_profissionais (
  servico_id uuid references servicos(id) on delete cascade not null,
  profissional_id uuid references profissionais(id) on delete cascade not null,
  primary key (servico_id, profissional_id)
);

alter table servico_profissionais enable row level security;

create policy "Servico_profissionais publicos para leitura" on servico_profissionais for select using (true);
create policy "Prestadora gerencia servico_profissionais dos proprios servicos" on servico_profissionais for all using (
  exists (
    select 1 from servicos
    join prestadoras on prestadoras.id = servicos.prestadora_id
    where servicos.id = servico_profissionais.servico_id and prestadoras.user_id = auth.uid()
  )
);
