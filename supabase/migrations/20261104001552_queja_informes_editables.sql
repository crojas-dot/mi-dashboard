-- Aditiva: no modifica Quejas, oficios, publicaciones ni eventos de correo.
-- Tipos y permisos efectivos verificados antes de aplicar.
begin;

create table public.queja_informes (
  queja_id uuid not null references public.quejas(id) on delete restrict,
  version integer not null check (version > 0),
  contenido text not null check (char_length(btrim(contenido)) between 1 and 100000),
  fuente_revision bigint not null check (fuente_revision >= 0),
  creado_por uuid not null references public.usuarios(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (queja_id, version)
);

create index queja_informes_autor_idx on public.queja_informes(creado_por);
alter table public.queja_informes enable row level security;
revoke all on public.queja_informes from public, anon, authenticated, service_role;
-- La API comprueba Bearer, perfil activo, rol staff y permisos de Quejas.
-- Incluso su rol servidor solo agrega versiones: no reemplaza ni borra historia.
grant select, insert on public.queja_informes to service_role;
comment on table public.queja_informes is 'Versiones internas del informe editable. Solo API autorizada; sin acceso público ni modificación del workflow.';

commit;
