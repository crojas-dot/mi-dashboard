-- Contexto propio de la asignación: separado de justificación, análisis y resolución.
-- Aditivo: no altera la RPC ni los clientes existentes de la transición.
create table public.queja_investigation_assignments (
  queja_id uuid primary key references public.quejas(id) on delete cascade,
  responsable_id uuid not null references public.usuarios(id),
  instrucciones text not null default '' check (length(instrucciones) <= 4000),
  oficio_adjunto_id uuid references public.queja_adjuntos(id) on delete set null,
  asignado_por uuid not null references public.usuarios(id),
  updated_at timestamptz not null default now()
);

alter table public.queja_investigation_assignments enable row level security;
revoke all on public.queja_investigation_assignments from public, anon, authenticated, service_role;
grant select on public.queja_investigation_assignments to authenticated, service_role;

-- Calidad/admin e investigador asignado pueden consultar el contexto de SU caso.
create policy assignment_context_authorized_read on public.queja_investigation_assignments
for select to authenticated using (
  (select auth.uid()) is not null and exists (
    select 1 from public.quejas q
    where q.id = queja_id and (
      coalesce((select public.app_es_admin()), false)
      or (coalesce((select public.app_es_staff()), false)
        and coalesce((select public.app_tiene_permiso('quejas', true)), false))
      or (coalesce((select public.app_es_colaborador()), false)
        and coalesce((select public.app_tiene_permiso('mis_quejas', true)), false)
        and q.responsable_id = (select public.app_usuario_actual_id()))
    )
  )
);

-- Un solo commit DB: transición con CAS y metadatos opcionales de asignación.
-- Direct INSERT/UPDATE de la tabla no se concede a authenticated.
create function public.qms_start_investigation_with_assignment(
  p_id uuid,
  p_expected bigint,
  p_justification text,
  p_justification_format text,
  p_owner uuid,
  p_instructions text default null,
  p_office_attachment uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q public.quejas;
  adj public.queja_adjuntos;
  result jsonb;
  editor uuid;
begin
  editor := public.app_usuario_actual_id();
  if (select auth.uid()) is null or editor is null or not (
    coalesce(public.app_es_admin(), false)
    or (coalesce(public.app_es_staff(), false)
      and coalesce(public.app_tiene_permiso('quejas', true), false))
  ) then
    raise exception 'No autorizado para asignar una investigación.' using errcode = '42501';
  end if;

  select * into q from public.quejas where id = p_id for update;
  if q.id is null then
    raise exception 'Queja no encontrada.' using errcode = 'P0002';
  end if;
  if q.revision is distinct from p_expected or p_expected is null then
    raise exception 'Otra persona modificó la queja. Actualiza antes de guardar.' using errcode = '40001';
  end if;
  if q.estado is distinct from 'Recibido' then
    raise exception 'La evaluación ya no está pendiente.' using errcode = '55000';
  end if;
  if nullif(btrim(coalesce(p_justification, '')), '') is null
    or length(p_justification) > 10000 or p_justification_format not in ('plain', 'markdown')
    or p_justification_format is null or p_owner is null
    or length(coalesce(p_instructions, '')) > 4000 then
    raise exception 'Revisa la justificación, responsable e instrucciones.' using errcode = '22023';
  end if;
  if p_office_attachment is not null then
    select * into adj from public.queja_adjuntos
    where id = p_office_attachment and queja_id = p_id and usuario_id = editor;
    if adj.id is null then
      raise exception 'El oficio debe estar adjunto a este expediente y haber sido subido por Calidad.' using errcode = '22023';
    end if;
  end if;

  result := public.qms_transition_complaint(
    p_id, p_expected, 'investigation',
    p_justification => p_justification,
    p_owner => p_owner,
    p_justification_format => p_justification_format
  );

  insert into public.queja_investigation_assignments
    (queja_id, responsable_id, instrucciones, oficio_adjunto_id, asignado_por)
  values (p_id, p_owner, btrim(coalesce(p_instructions, '')), p_office_attachment, editor)
  on conflict (queja_id) do update set
    responsable_id = excluded.responsable_id,
    instrucciones = excluded.instrucciones,
    oficio_adjunto_id = excluded.oficio_adjunto_id,
    asignado_por = excluded.asignado_por,
    updated_at = now();

  return result;
end $$;

revoke all on function public.qms_start_investigation_with_assignment(
  uuid,bigint,text,text,uuid,text,uuid
) from public, anon, authenticated, service_role;
grant execute on function public.qms_start_investigation_with_assignment(
  uuid,bigint,text,text,uuid,text,uuid
) to authenticated;
