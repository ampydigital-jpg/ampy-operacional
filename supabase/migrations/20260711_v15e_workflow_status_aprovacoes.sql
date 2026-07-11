alter table public.feed_board_items
add column if not exists workflow_status text not null default 'awaiting_approval';

alter table public.feed_board_items
drop constraint if exists feed_board_items_workflow_status_check;

alter table public.feed_board_items
add constraint feed_board_items_workflow_status_check
check (workflow_status in ('awaiting_approval', 'approved', 'changes_requested', 'scheduled'));

update public.feed_board_items
set workflow_status = case
  when approval_status = 'approved' then 'approved'
  when approval_status = 'changes_requested' then 'changes_requested'
  else 'awaiting_approval'
end
where workflow_status is null
   or workflow_status = 'awaiting_approval';

create index if not exists idx_feed_board_items_workflow_status
on public.feed_board_items(workflow_status);
