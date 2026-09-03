-- Nova categoria 'Comissao' pra lançamentos automáticos criados ao marcar
-- uma comissão de profissional como paga (ver "Marcar como paga" no
-- relatório financeiro).

ALTER TABLE lancamentos_financeiros
  DROP CONSTRAINT IF EXISTS lancamentos_financeiros_categoria_check;

ALTER TABLE lancamentos_financeiros
  ADD CONSTRAINT lancamentos_financeiros_categoria_check
    CHECK (categoria IN ('Aluguel', 'Salario', 'Equipamento', 'Material', 'Comissao', 'Outro'));

-- Mesma categoria na tabela de regras de recorrência, pra manter os dois
-- enums em sincronia (evita erro silencioso se uma recorrência algum dia
-- usar essa categoria).
ALTER TABLE lancamentos_recorrencias
  DROP CONSTRAINT IF EXISTS lancamentos_recorrencias_categoria_check;

ALTER TABLE lancamentos_recorrencias
  ADD CONSTRAINT lancamentos_recorrencias_categoria_check
    CHECK (categoria IN ('Aluguel', 'Salario', 'Equipamento', 'Material', 'Comissao', 'Outro'));
