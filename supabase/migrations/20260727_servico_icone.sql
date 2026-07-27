-- Permite escolher um ícone (lucide-react) para cada serviço, exibido no
-- painel e na página pública em vez da tesoura fixa.
ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS icone text DEFAULT 'Scissors';
