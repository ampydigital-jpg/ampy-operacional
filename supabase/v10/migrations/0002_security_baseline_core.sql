begin;

do $$
begin
  if to_regprocedure('auth.uid()') is null then
    raise exception 'V10.0-A1: auth.uid() nao encontrada.';
  end if;

  if to_regprocedure('auth.jwt()') is null then
    raise exception 'V10.0-A1: auth.jwt() nao encontrada.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'work_items'
      and policyname = 'demands_read_authenticated'
  ) then
    raise exception 'V10.0-A1: policy demands_read_authenticated ausente.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_own'
  ) then
    raise exception 'V10.0-A1: policy profiles_update_own ausente.';
  end if;
end
$$;

-- ============================================================
-- 1. TOTAL ACCESS EXIGE PROFILE ATIVO
-- Mantemos as duas funcoes por compatibilidade.
-- Cleanup/contracao continua reservado para V10.8.
-- ============================================================

create or replace function public.app_has_total_access()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $function$
  select exists (
    select 1
    from public.team_members tm
    join public.profiles p
      on p.id = auth.uid()
    where p.is_active = true
      and tm.is_active = true
      and tm.access_type = 'total'
      and (
        tm.profile_id = auth.uid()
        or lower(tm.email) = lower(p.email)
      )
  );
$function$;

create or replace function public.has_total_access()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $function$
  select exists (
    select 1
    from public.team_members tm
    join public.profiles p
      on p.id = auth.uid()
    where p.is_active = true
      and tm.is_active = true
      and tm.access_type = 'total'
      and (
        tm.profile_id = auth.uid()
        or lower(tm.email) = lower(p.email)
      )
  );
$function$;

-- ============================================================
-- 2. EVENT TRIGGER DE RLS
-- Producao ja possui rls_auto_enable.
-- Local nao possui.
-- Criamos apenas quando o nome ainda nao existe.
-- ============================================================

create or replace function extensions.v10_rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in (
      'CREATE TABLE',
      'CREATE TABLE AS',
      'SELECT INTO'
    )
      and schema_name = 'public'
  loop
    execute format(
      'alter table if exists %s enable row level security',
      cmd.object_identity
    );
  end loop;
end;
$function$;

do $$
begin
  if not exists (
    select 1
    from pg_event_trigger
    where evtname = 'rls_auto_enable'
  ) then
    execute
      'create event trigger rls_auto_enable
       on ddl_command_end
       execute function extensions.v10_rls_auto_enable()';
  end if;
end
$$;

-- ============================================================
-- 3. PRIVILEGIOS ESTRUTURAIS
-- RLS nao protege TRUNCATE.
-- authenticated nao precisa criar trigger nem FK.
-- ============================================================

revoke truncate, references, trigger
on all tables in schema public
from authenticated;

alter default privileges
for role postgres
in schema public
revoke truncate, references, trigger
on tables
from authenticated;

-- As seis tabelas abaixo continuam sendo escritas pelo servidor.
-- authenticated nao deve ter DML direto.

revoke insert, update, delete
on table
  public.pautas,
  public.pauta_members,
  public.pauta_events,
  public.work_item_board_assignments,
  public.work_item_board_assignment_events,
  public.calendar_event_history
from authenticated;

-- ============================================================
-- 4. AUDITORIA
-- ============================================================

alter policy authenticated_read_audit_logs
on public.audit_logs
using (
  public.app_is_manager()
  or public.app_has_total_access()
);

-- ============================================================
-- 5. ESTRUTURA DE QUADROS
-- Leitura e compartilhada somente entre usuarios ativos.
-- Estrutura continua protegida por Acesso Total.
-- ============================================================

alter policy boards_select_authenticated
on public.boards
using (
  public.app_is_active_user()
);

alter policy board_columns_select_authenticated
on public.board_columns
using (
  public.app_is_active_user()
);

-- ============================================================
-- 6. CLIENTES
-- Collaborator enxerga apenas cliente sob sua responsabilidade.
-- Managers/Acesso Total preservam visao ampla.
-- ============================================================

alter policy clients_read_authenticated
on public.clients
using (
  public.app_is_manager()
  or public.app_has_total_access()
  or (
    public.app_is_active_user()
    and responsible_id = auth.uid()
  )
);

alter policy client_services_read_authenticated
on public.client_services
using (
  public.app_is_manager()
  or public.app_has_total_access()
  or (
    public.app_is_active_user()
    and (
      responsible_id = auth.uid()
      or exists (
        select 1
        from public.clients c
        where c.id = client_services.client_id
      )
    )
  )
);

-- ============================================================
-- 7. DEMANDA CANONICA
-- ============================================================

alter policy demands_read_authenticated
on public.work_items
using (
  public.app_is_manager()
  or public.app_has_total_access()
  or (
    public.app_is_active_user()
    and (
      responsible_id = auth.uid()
      or created_by = auth.uid()
      or exists (
        select 1
        from public.clients c
        where c.id = work_items.client_id
      )
      or exists (
        select 1
        from public.client_services cs
        where cs.id = work_items.client_service_id
      )
    )
  )
);

alter policy demands_create_authenticated
on public.work_items
with check (
  public.app_is_manager()
  or public.app_has_total_access()
  or (
    public.app_is_active_user()
    and created_by = auth.uid()
    and (
      responsible_id is null
      or responsible_id = auth.uid()
    )
    and (
      client_id is null
      or exists (
        select 1
        from public.clients c
        where c.id = work_items.client_id
      )
    )
    and (
      client_service_id is null
      or exists (
        select 1
        from public.client_services cs
        where cs.id = work_items.client_service_id
      )
    )
  )
);

alter policy demands_update_operational
on public.work_items
using (
  public.app_is_manager()
  or public.app_has_total_access()
  or (
    public.app_is_active_user()
    and (
      responsible_id = auth.uid()
      or created_by = auth.uid()
      or exists (
        select 1
        from public.clients c
        where c.id = work_items.client_id
      )
      or exists (
        select 1
        from public.client_services cs
        where cs.id = work_items.client_service_id
      )
    )
  )
)
with check (
  public.app_is_manager()
  or public.app_has_total_access()
  or (
    public.app_is_active_user()
    and (
      responsible_id = auth.uid()
      or created_by = auth.uid()
      or exists (
        select 1
        from public.clients c
        where c.id = work_items.client_id
      )
      or exists (
        select 1
        from public.client_services cs
        where cs.id = work_items.client_service_id
      )
    )
  )
);

-- DELETE continua restrito a manager pela policy existente.

-- ============================================================
-- 8. FILHOS DA DEMANDA
-- A visibilidade do work_item vira a fonte canonica de escopo.
-- ============================================================

alter policy authenticated_all_approvals
on public.approvals
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = approvals.work_item_id
  )
)
with check (
  exists (
    select 1
    from public.work_items wi
    where wi.id = approvals.work_item_id
  )
);

alter policy authenticated_all_blockers
on public.blockers
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = blockers.work_item_id
  )
)
with check (
  exists (
    select 1
    from public.work_items wi
    where wi.id = blockers.work_item_id
  )
);

alter policy authenticated_all_checklists
on public.work_item_checklists
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = work_item_checklists.work_item_id
  )
)
with check (
  exists (
    select 1
    from public.work_items wi
    where wi.id = work_item_checklists.work_item_id
  )
);

alter policy authenticated_all_comments
on public.work_item_comments
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = work_item_comments.work_item_id
  )
)
with check (
  exists (
    select 1
    from public.work_items wi
    where wi.id = work_item_comments.work_item_id
  )
);

alter policy authenticated_read_history
on public.work_item_history
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = work_item_history.work_item_id
  )
);

alter policy history_read_authenticated
on public.work_item_history
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = work_item_history.work_item_id
  )
);

alter policy history_insert_authenticated
on public.work_item_history
with check (
  public.app_is_active_user()
  and (
    actor_id = auth.uid()
    or actor_id is null
  )
  and exists (
    select 1
    from public.work_items wi
    where wi.id = work_item_history.work_item_id
  )
);

alter policy work_item_schedule_requirements_read_authenticated
on public.work_item_schedule_requirements
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = work_item_schedule_requirements.work_item_id
  )
);

alter policy work_item_schedule_requirements_insert_authenticated
on public.work_item_schedule_requirements
with check (
  exists (
    select 1
    from public.work_items wi
    where wi.id = work_item_schedule_requirements.work_item_id
  )
);

alter policy work_item_schedule_requirements_update_authenticated
on public.work_item_schedule_requirements
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = work_item_schedule_requirements.work_item_id
  )
)
with check (
  exists (
    select 1
    from public.work_items wi
    where wi.id = work_item_schedule_requirements.work_item_id
  )
);

-- ============================================================
-- 9. PAUTA
-- As seis tabelas continuam sem DML authenticated.
-- Apenas SELECT e estreitado.
-- ============================================================

alter policy pautas_select_active_users
on public.pautas
using (
  public.app_is_manager()
  or public.app_has_total_access()
  or (
    public.app_is_active_user()
    and (
      created_by = auth.uid()
      or exists (
        select 1
        from public.work_items wi
        where wi.pauta_id = pautas.id
      )
    )
  )
);

alter policy pauta_members_select_active_users
on public.pauta_members
using (
  exists (
    select 1
    from public.pautas p
    where p.id = pauta_members.pauta_id
  )
  or exists (
    select 1
    from public.clients c
    where c.id = pauta_members.client_id
  )
);

alter policy pauta_events_select_active_users
on public.pauta_events
using (
  public.app_is_manager()
  or public.app_has_total_access()
  or exists (
    select 1
    from public.pautas p
    where p.id = pauta_events.pauta_id
  )
);

-- ============================================================
-- 10. MULTIQUADRO
-- ============================================================

alter policy work_item_board_assignments_select_active
on public.work_item_board_assignments
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = work_item_board_assignments.work_item_id
  )
);

alter policy work_item_board_assignment_events_select_active
on public.work_item_board_assignment_events
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = work_item_board_assignment_events.work_item_id
  )
);

-- ============================================================
-- 11. AGENDA
-- ============================================================

alter policy agenda_read_authenticated
on public.calendar_events
using (
  public.app_is_manager()
  or public.app_has_total_access()
  or (
    public.app_is_active_user()
    and (
      responsible_id = auth.uid()
      or created_by = auth.uid()
      or exists (
        select 1
        from public.work_items wi
        where wi.id = calendar_events.work_item_id
      )
      or exists (
        select 1
        from public.clients c
        where c.id = calendar_events.client_id
      )
      or exists (
        select 1
        from public.pautas p
        where p.id = calendar_events.pauta_id
      )
    )
  )
);

alter policy agenda_create_authenticated
on public.calendar_events
with check (
  public.app_is_manager()
  or public.app_has_total_access()
  or (
    public.app_is_active_user()
    and (
      created_by = auth.uid()
      or responsible_id = auth.uid()
      or exists (
        select 1
        from public.work_items wi
        where wi.id = calendar_events.work_item_id
      )
      or exists (
        select 1
        from public.clients c
        where c.id = calendar_events.client_id
      )
      or exists (
        select 1
        from public.pautas p
        where p.id = calendar_events.pauta_id
      )
    )
  )
);

alter policy agenda_update_operational
on public.calendar_events
using (
  public.app_is_manager()
  or public.app_has_total_access()
  or (
    public.app_is_active_user()
    and (
      responsible_id = auth.uid()
      or created_by = auth.uid()
      or exists (
        select 1
        from public.work_items wi
        where wi.id = calendar_events.work_item_id
      )
      or exists (
        select 1
        from public.clients c
        where c.id = calendar_events.client_id
      )
      or exists (
        select 1
        from public.pautas p
        where p.id = calendar_events.pauta_id
      )
    )
  )
)
with check (
  public.app_is_manager()
  or public.app_has_total_access()
  or (
    public.app_is_active_user()
    and (
      responsible_id = auth.uid()
      or created_by = auth.uid()
      or exists (
        select 1
        from public.work_items wi
        where wi.id = calendar_events.work_item_id
      )
      or exists (
        select 1
        from public.clients c
        where c.id = calendar_events.client_id
      )
      or exists (
        select 1
        from public.pautas p
        where p.id = calendar_events.pauta_id
      )
    )
  )
);

alter policy agenda_delete_operational
on public.calendar_events
using (
  public.app_is_manager()
  or public.app_has_total_access()
  or (
    public.app_is_active_user()
    and (
      responsible_id = auth.uid()
      or created_by = auth.uid()
    )
  )
);

alter policy calendar_event_history_select_authenticated
on public.calendar_event_history
using (
  exists (
    select 1
    from public.calendar_events ce
    where ce.id = calendar_event_history.event_id
  )
);

-- ============================================================
-- 12. PROJETOS - SOMENTE ESTRUTURAS FILHAS DO WORK_ITEM
-- projects propriamente dito fica para V10.0-A2.
-- ============================================================

alter policy steps_read_authenticated
on public.project_steps
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = project_steps.work_item_id
  )
);

alter policy steps_operational
on public.project_steps
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = project_steps.work_item_id
  )
)
with check (
  exists (
    select 1
    from public.work_items wi
    where wi.id = project_steps.work_item_id
  )
);

alter policy project_step_statuses_select_authenticated
on public.project_step_statuses
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = project_step_statuses.work_item_id
  )
);

alter policy project_step_statuses_insert_authenticated
on public.project_step_statuses
with check (
  exists (
    select 1
    from public.work_items wi
    where wi.id = project_step_statuses.work_item_id
  )
);

alter policy project_step_statuses_update_authenticated
on public.project_step_statuses
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = project_step_statuses.work_item_id
  )
)
with check (
  exists (
    select 1
    from public.work_items wi
    where wi.id = project_step_statuses.work_item_id
  )
);

alter policy project_step_statuses_delete_authenticated
on public.project_step_statuses
using (
  exists (
    select 1
    from public.work_items wi
    where wi.id = project_step_statuses.work_item_id
  )
);

-- ============================================================
-- 13. PROFILES
-- Duplicatas sao mantidas ate V10.8, mas deixam de abrir acesso
-- por USING(true).
--
-- profiles_update_own:
--   - nao pode elevar role;
--   - nao pode reativar/desativar a si proprio;
--   - nao pode trocar email do profile para herdar Acesso Total.
-- ============================================================

alter policy authenticated_read_profiles
on public.profiles
using (
  public.app_is_active_user()
);

alter policy profiles_read_authenticated
on public.profiles
using (
  public.app_is_active_user()
);

alter policy profiles_update_own
on public.profiles
using (
  auth.uid() = id
  and public.app_is_active_user()
)
with check (
  auth.uid() = id
  and public.app_is_active_user()
  and is_active = true
  and role = public.app_current_role()
  and (auth.jwt() ->> 'email') is not null
  and lower(email) = lower(auth.jwt() ->> 'email')
);

commit;