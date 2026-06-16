# NailBook — Setup

## 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em **SQL Editor** e execute todo o conteúdo de `supabase/schema.sql`
3. Em **Authentication > Providers**, certifique-se que Email está habilitado
4. Em **Storage**, confirme que os buckets `galeria` e `avatars` foram criados

## 2. Variáveis de ambiente

Copie as chaves do seu projeto Supabase (**Settings > API**) e cole no `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## 3. Rodar localmente

```bash
npm install
npm run dev
```

Acesse: http://localhost:3000

## 4. Fluxo

- **Prestadora**: Cria conta em `/painel/cadastro` → gerencia tudo no `/painel`
- **Cliente**: Acessa `/n/slug-da-nail` → escolhe serviço → agenda

## Realtime

O Supabase Realtime já está configurado no schema (`agendamentos` e `notificacoes`).
Certifique-se que está habilitado em **Database > Replication** no painel do Supabase.
