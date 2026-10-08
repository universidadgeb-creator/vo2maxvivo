-- Historial de pruebas VO2max vivo47. Pégalo en Supabase → SQL Editor → Run.
create table if not exists public.pruebas (
  id         text primary key,                 -- telefono_fecha
  telefono   text not null,
  fecha      timestamptz not null,
  datos      jsonb not null,                   -- resumen completo de la prueba
  creado_por uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pruebas_telefono_idx on public.pruebas (telefono, fecha);

-- Solo el personal con sesión iniciada puede leer y escribir; sin sesión no se ve nada.
alter table public.pruebas enable row level security;
drop policy if exists "personal lee" on public.pruebas;
drop policy if exists "personal inserta" on public.pruebas;
drop policy if exists "personal actualiza" on public.pruebas;
drop policy if exists "personal borra" on public.pruebas;
create policy "personal lee"       on public.pruebas for select to authenticated using (true);
create policy "personal inserta"   on public.pruebas for insert to authenticated with check (true);
create policy "personal actualiza" on public.pruebas for update to authenticated using (true) with check (true);
create policy "personal borra"     on public.pruebas for delete to authenticated using (true);
revoke all on public.pruebas from anon;
