begin;

-- ============================================================
-- PRIVILEGIOS
-- ============================================================

grant truncate, references, trigger
on all tables in schema public
to authenticated;

alter default privileges
for role postgres
in schema public
grant truncate, references, trigger
on tables
to authenticated;

grant insert, update, delete
on table
  public.pautas,
  public.pauta_members,
  public.pauta_events,
  public.work_item_board_assignments,
  public.work_item_board_assignment_events,
  public.calendar_event_history
to authenticated;

-- ============================================================
-- FUNCOES DE ACESSO ORIGINAIS
-- ============================================================

create or replace function public.app_has_total_access()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    LEFT JOIN public.profiles p
      ON p.id = auth.uid()
    WHERE tm.is_active = true
      AND tm.access_type = 'total'
      AND (
        tm.profile_id = auth.uid()
        OR (
          p.email IS NOT NULL
          AND lower(tm.email) = lower(p.email)
        )
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
    where tm.profile_id = auth.uid()
      and tm.is_active is true
      and tm.access_type = 'total'
  );
$function$;

-- ============================================================
-- POLICIES ORIGINAIS
-- ============================================================

alter policy authenticated_read_audit_logs
on public.audit_logs
using (true);

alter policy boards_select_authenticated
on public.boards
using (true);

alter policy board_columns_select_authenticated
on public.board_columns
using (true);

alter policy clients_read_authenticated
on public.clients
using (
  public.app_is_active_user()
);

alter policy client_services_read_authenticated
on public.client_services
using (
  public.app_is_active_user()
);

alter policy demands_read_authenticated
on public.work_items
using (
  public.app_is_active_user()
);

alter policy demands_create_authenticated
on public.work_items
with check (
  public.app_is_active_user()
  and (
    created_by = auth.uid()
    or created_by is null
  )
);

alter policy demands_update_operational
on public.work_items
using (
  public.app_is_manager()
  or (
    public.app_is_active_user()
    and (
      responsible_id = auth.uid()
      or created_by = auth.uid()
    )
  )
)
with check (
  public.app_is_manager()
  or (
    public.app_is_active_user()
    and (
      responsible_id = auth.uid()
      or created_by = auth.uid()
    )
  )
);

alter policy authenticated_all_approvals
on public.approvals
using (true)
with check (true);

alter policy authenticated_all_blockers
on public.blockers
using (true)
with check (true);

alter policy authenticated_all_checklists
on public.work_item_checklists
using (true)
with check (true);

alter policy authenticated_all_comments
on public.work_item_comments
using (true)
with check (true);

alter policy authenticated_read_history
on public.work_item_history
using (true);

alter policy history_read_authenticated
on public.work_item_history
using (
  public.app_is_active_user()
);

alter policy history_insert_authenticated
on public.work_item_history
with check (
  public.app_is_active_user()
  and (
    actor_id = auth.uid()
    or actor_id is null
  )
);

alter policy work_item_schedule_requirements_read_authenticated
on public.work_item_schedule_requirements
using (
  public.app_is_active_user()
);

alter policy work_item_schedule_requirements_insert_authenticated
on public.work_item_schedule_requirements
with check (
  public.app_is_active_user()
);

alter policy work_item_schedule_requirements_update_authenticated
on public.work_item_schedule_requirements
using (
  public.app_is_active_user()
)
with check (
  public.app_is_active_user()
);

alter policy pautas_select_active_users
on public.pautas
using (
  public.app_is_active_user()
);

alter policy pauta_members_select_active_users
on public.pauta_members
using (
  public.app_is_active_user()
);

alter policy pauta_events_select_active_users
on public.pauta_events
using (
  public.app_is_active_user()
);

alter policy work_item_board_assignments_select_active
on public.work_item_board_assignments
using (
  public.app_is_active_user()
);

alter policy work_item_board_assignment_events_select_active
on public.work_item_board_assignment_events
using (
  public.app_is_active_user()
);

alter policy agenda_read_authenticated
on public.calendar_events
using (
  public.app_is_active_user()
);

alter policy agenda_create_authenticated
on public.calendar_events
with check (
  public.app_is_active_user()
  and (
    created_by = auth.uid()
    or created_by is null
  )
);

alter policy agenda_update_operational
on public.calendar_events
using (
  public.app_is_manager()
  or (
    public.app_is_active_user()
    and (
      responsible_id = auth.uid()
      or created_by = auth.uid()
    )
  )
)
with check (
  public.app_is_manager()
  or (
    public.app_is_active_user()
    and (
      responsible_id = auth.uid()
      or created_by = auth.uid()
    )
  )
);

alter policy agenda_delete_operational
on public.calendar_events
using (
  public.app_is_manager()
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
using (true);

alter policy steps_read_authenticated
on public.project_steps
using (
  public.app_is_active_user()
);

alter policy steps_operational
on public.project_steps
using (
  public.app_is_manager()
  or exists (
    select 1
    from public.work_items w
    where w.id = project_steps.work_item_id
      and public.app_is_active_user()
      and (
        w.responsible_id = auth.uid()
        or w.created_by = auth.uid()
      )
  )
)
with check (
  public.app_is_manager()
  or exists (
    select 1
    from public.work_items w
    where w.id = project_steps.work_item_id
      and public.app_is_active_user()
      and (
        w.responsible_id = auth.uid()
        or w.created_by = auth.uid()
      )
  )
);

alter policy project_step_statuses_select_authenticated
on public.project_step_statuses
using (true);

alter policy project_step_statuses_insert_authenticated
on public.project_step_statuses
with check (true);

alter policy project_step_statuses_update_authenticated
on public.project_step_statuses
using (true)
with check (true);

alter policy project_step_statuses_delete_authenticated
on public.project_step_statuses
using (true);

alter policy authenticated_read_profiles
on public.profiles
using (true);

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
);

-- ============================================================
-- EVENT TRIGGER
-- Somente removemos rls_auto_enable se ele for o criado pela A1.
-- O trigger preexistente de producao nao e tocado.
-- ============================================================

do $$
declare
  v_function oid;
begin
  select evtfoid
  into v_function
  from pg_event_trigger
  where evtname = 'rls_auto_enable';

  if v_function is not null
     and v_function =
       to_regprocedure('extensions.v10_rls_auto_enable()')
  then
    execute 'drop event trigger rls_auto_enable';
  end if;
end
$$;

drop function if exists extensions.v10_rls_auto_enable();

commit;