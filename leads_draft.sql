-- Extensión para UUIDs
create extension if not exists pgcrypto; -- gen_random_uuid()

-- Tabla sencilla (incluye 'meta')
create table if not exists public.leads_draft (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Contacto (SIN checks de validación)
  name        text not null,
  phone       text,
  email       text,

  -- Dirección
  country     text not null,
  state       text,
  city        text,
  address     text,

  -- Origen
  section_id  text not null,
  domain      text not null,
  url         text,

  -- Productos tal cual llegan
  products    jsonb not null default '[]'::jsonb
              check (jsonb_typeof(products) = 'array'),

  id_store    integer not null,

  -- Metadatos opcionales
  meta        jsonb not null default '{}'::jsonb
);

comment on table public.leads_draft is 'Leads en borrador recibidos por formularios/webhooks.';
comment on column public.leads_draft.meta is 'Metadatos adicionales del lead (jsonb).';

-- Índices básicos
create index if not exists leads_draft_created_at_idx on public.leads_draft (created_at desc);
create index if not exists leads_draft_id_store_idx   on public.leads_draft (id_store);

-- Dedupe simple: misma combinación (domain, section_id, phone)
create unique index if not exists leads_draft_uniq_domain_section_phone
  on public.leads_draft (domain, section_id, phone);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_set_updated_at on public.leads_draft;
create trigger trg_set_updated_at
before update on public.leads_draft
for each row execute function public.set_updated_at();

-- RLS activado (seguro por defecto)
alter table public.leads_draft enable row level security;

-- (Opcional) refrescar el esquema del API:
-- notify pgrst, 'reload schema';
