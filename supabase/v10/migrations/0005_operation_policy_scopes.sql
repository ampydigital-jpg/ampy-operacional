-- PENDENTE DE APROVACAO. NAO EXECUTADA. Aplicar depois de 0002-0004.
-- Politicas RESTRICTIVE limitam tambem as policies permissivas duplicadas.
-- Nenhuma das 23 tabelas de integracoes e alterada.
begin;

create policy eyxo_active_user_guard on public.projects
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.work_item_comments
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.work_item_checklists
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.approvals
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.blockers
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.resource_links
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.audit_logs
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.chat_messages
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.feed_posts
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.project_steps
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.profiles
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.work_item_history
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.service_catalog
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.calendar_events
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.clients
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.client_services
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.feed_board_events
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.feed_boards
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.feed_board_item_assets
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.feed_board_items
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.avisos
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.internal_messages
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.internal_message_mentions
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.boards
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.project_step_statuses
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.board_columns
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.team_access_audit
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.team_members
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.work_item_schedule_requirements
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.pautas
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.work_items
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.pauta_events
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.pauta_members
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.work_item_board_assignments
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.work_item_board_assignment_events
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_active_user_guard on public.calendar_event_history
as restrictive for all to authenticated
using (public.app_is_active_user()) with check (public.app_is_active_user());

create policy eyxo_context_guard on public.projects
as restrictive for all to authenticated
using ((public.app_is_manager() or public.app_has_total_access()) or responsible_id = auth.uid() or exists (select 1 from public.clients c where c.id = projects.client_id)) with check ((public.app_is_manager() or public.app_has_total_access()) or responsible_id = auth.uid() or exists (select 1 from public.clients c where c.id = projects.client_id));

create policy eyxo_context_guard on public.feed_posts
as restrictive for all to authenticated
using ((public.app_is_manager() or public.app_has_total_access()) or exists (select 1 from public.clients c where c.id = feed_posts.client_id)) with check ((public.app_is_manager() or public.app_has_total_access()) or exists (select 1 from public.clients c where c.id = feed_posts.client_id));

create policy eyxo_context_guard on public.feed_boards
as restrictive for all to authenticated
using ((public.app_is_manager() or public.app_has_total_access()) or created_by = auth.uid() or exists (select 1 from public.clients c where c.id = feed_boards.client_id)) with check ((public.app_is_manager() or public.app_has_total_access()) or created_by = auth.uid() or exists (select 1 from public.clients c where c.id = feed_boards.client_id));

create policy eyxo_context_guard on public.feed_board_items
as restrictive for all to authenticated
using (exists (select 1 from public.feed_boards b where b.id = feed_board_items.board_id)) with check (exists (select 1 from public.feed_boards b where b.id = feed_board_items.board_id));

create policy eyxo_context_guard on public.feed_board_item_assets
as restrictive for all to authenticated
using (exists (select 1 from public.feed_boards b where b.id = feed_board_item_assets.board_id)) with check (exists (select 1 from public.feed_boards b where b.id = feed_board_item_assets.board_id));

create policy eyxo_context_guard on public.feed_board_events
as restrictive for all to authenticated
using (exists (select 1 from public.feed_boards b where b.id = feed_board_events.board_id)) with check (exists (select 1 from public.feed_boards b where b.id = feed_board_events.board_id));

create policy eyxo_context_guard on public.resource_links
as restrictive for all to authenticated
using ((public.app_is_manager() or public.app_has_total_access()) or created_by = auth.uid() or (entity_type in ('work_item','demand') and exists (select 1 from public.work_items wi where wi.id = resource_links.entity_id)) or (entity_type = 'client' and exists (select 1 from public.clients c where c.id = resource_links.entity_id))) with check ((public.app_is_manager() or public.app_has_total_access()) or created_by = auth.uid() or (entity_type in ('work_item','demand') and exists (select 1 from public.work_items wi where wi.id = resource_links.entity_id)) or (entity_type = 'client' and exists (select 1 from public.clients c where c.id = resource_links.entity_id)));

create policy eyxo_context_guard on public.avisos
as restrictive for all to authenticated
using ((public.app_is_manager() or public.app_has_total_access()) or created_by = auth.uid() or assigned_to = auth.uid() or lower(assigned_email) = lower(auth.jwt()->>'email') or exists (select 1 from public.team_members tm where tm.id = avisos.assigned_team_member_id and tm.profile_id = auth.uid() and tm.is_active) or exists (select 1 from public.work_items wi where wi.id = avisos.work_item_id) or exists (select 1 from public.clients c where c.id = avisos.client_id) or exists (select 1 from public.feed_boards b where b.id = avisos.feed_board_id)) with check ((public.app_is_manager() or public.app_has_total_access()) or created_by = auth.uid() or assigned_to = auth.uid() or lower(assigned_email) = lower(auth.jwt()->>'email') or exists (select 1 from public.team_members tm where tm.id = avisos.assigned_team_member_id and tm.profile_id = auth.uid() and tm.is_active) or exists (select 1 from public.work_items wi where wi.id = avisos.work_item_id) or exists (select 1 from public.clients c where c.id = avisos.client_id) or exists (select 1 from public.feed_boards b where b.id = avisos.feed_board_id));

create policy eyxo_context_guard on public.internal_messages
as restrictive for all to authenticated
using ((public.app_is_manager() or public.app_has_total_access()) or created_by_profile_id = auth.uid() or (context_type = 'general' and work_item_id is null and client_id is null and feed_board_id is null and aviso_id is null) or exists (select 1 from public.work_items wi where wi.id = internal_messages.work_item_id) or exists (select 1 from public.clients c where c.id = internal_messages.client_id) or exists (select 1 from public.feed_boards b where b.id = internal_messages.feed_board_id) or exists (select 1 from public.avisos a where a.id = internal_messages.aviso_id)) with check ((public.app_is_manager() or public.app_has_total_access()) or created_by_profile_id = auth.uid() or (context_type = 'general' and work_item_id is null and client_id is null and feed_board_id is null and aviso_id is null) or exists (select 1 from public.work_items wi where wi.id = internal_messages.work_item_id) or exists (select 1 from public.clients c where c.id = internal_messages.client_id) or exists (select 1 from public.feed_boards b where b.id = internal_messages.feed_board_id) or exists (select 1 from public.avisos a where a.id = internal_messages.aviso_id));

create policy eyxo_context_guard on public.internal_message_mentions
as restrictive for all to authenticated
using ((public.app_is_manager() or public.app_has_total_access()) or mentioned_profile_id = auth.uid() or lower(mentioned_email) = lower(auth.jwt()->>'email') or exists (select 1 from public.internal_messages m where m.id = internal_message_mentions.message_id)) with check ((public.app_is_manager() or public.app_has_total_access()) or mentioned_profile_id = auth.uid() or lower(mentioned_email) = lower(auth.jwt()->>'email') or exists (select 1 from public.internal_messages m where m.id = internal_message_mentions.message_id));

-- Historico/autoria e mensagens internas sao gravados pelo servidor autorizado.
revoke insert, update, delete on public.internal_messages, public.internal_message_mentions from authenticated, anon;
create policy eyxo_chat_insert_author on public.chat_messages
as restrictive for insert to authenticated with check (author_id = auth.uid());
create policy eyxo_chat_update_author on public.chat_messages
as restrictive for update to authenticated
using (author_id = auth.uid() or (public.app_is_manager() or public.app_has_total_access())) with check (author_id = auth.uid() or (public.app_is_manager() or public.app_has_total_access()));
create policy eyxo_chat_delete_author on public.chat_messages
as restrictive for delete to authenticated using (author_id = auth.uid() or (public.app_is_manager() or public.app_has_total_access()));
commit;

