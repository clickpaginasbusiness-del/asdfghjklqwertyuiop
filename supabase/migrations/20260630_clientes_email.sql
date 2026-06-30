-- Adiciona coluna email em clientes para suportar login via Google.
-- Índice único parcial: só aplica a emails não-nulos (clientes sem Google não têm email).
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS clientes_email_idx ON clientes (email) WHERE email IS NOT NULL;
