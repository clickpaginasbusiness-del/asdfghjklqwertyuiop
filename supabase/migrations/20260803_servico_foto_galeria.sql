-- Permite usar uma foto da galeria como "ícone" do serviço, além dos ícones
-- fixos do lucide-react já existentes.

ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS foto_galeria_id uuid
  REFERENCES galeria(id) ON DELETE SET NULL;
