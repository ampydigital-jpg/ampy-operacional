-- SNAPSHOT DOCUMENTAL DO SCHEMA EM 2026-10-06. NAO E MIGRATION DE PRODUCAO.

-- Sem dados, credenciais ou seeds. Captura atual das tabelas anteriores a 04/08 e suas evolucoes.

create table public."ampy_agentes" (
  "slug" text not null,
  "nome" text not null,
  "sistema" text not null,
  "descricao" text not null,
  "status" text not null,
  "canal" text,
  "n8n_workflows" text[] default '{}'::text[] not null,
  "supabase_tabelas" text[] default '{}'::text[] not null,
  "edge_function" text,
  "segredo_vault" text,
  "credenciais_n8n" text[] default '{}'::text[] not null,
  "responsavel" text,
  "observacoes" text,
  "criado_em" timestamp with time zone default now() not null,
  "atualizado_em" timestamp with time zone default now() not null
);

create table public."approvals" (
  "id" uuid default uuid_generate_v4() not null,
  "work_item_id" uuid not null,
  "version" integer default 1 not null,
  "sent_by" uuid,
  "sent_at" timestamp with time zone default now() not null,
  "deadline" date,
  "status" text default 'pending'::text not null,
  "feedback" text,
  "drive_link" text,
  "responded_at" timestamp with time zone
);

create table public."audit_logs" (
  "id" uuid default uuid_generate_v4() not null,
  "actor_id" uuid,
  "action" text not null,
  "entity_type" text not null,
  "entity_id" uuid,
  "before_data" jsonb,
  "after_data" jsonb,
  "ip" text,
  "created_at" timestamp with time zone default now() not null
);

create table public."avisos" (
  "id" uuid default gen_random_uuid() not null,
  "title" text not null,
  "message" text not null,
  "category" text default 'operational'::text not null,
  "priority" text default 'medium'::text not null,
  "status" text default 'active'::text not null,
  "source_module" text,
  "source_table" text,
  "source_id" uuid,
  "source_url" text,
  "action_label" text,
  "related_entity_type" text,
  "related_entity_id" uuid,
  "dedupe_key" text,
  "client_id" uuid,
  "work_item_id" uuid,
  "feed_board_id" uuid,
  "feed_board_item_id" uuid,
  "feed_board_event_id" uuid,
  "due_at" timestamp with time zone,
  "reminder_at" timestamp with time zone,
  "read_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_by" uuid,
  "assigned_to" uuid,
  "is_auto" boolean default true not null,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "assigned_team_member_id" uuid,
  "assigned_email" text,
  "assigned_area" text,
  "assigned_role" text,
  "notify_by_email" boolean default false not null,
  "email_notified_at" timestamp with time zone
);

create table public."blockers" (
  "id" uuid default uuid_generate_v4() not null,
  "work_item_id" uuid not null,
  "type" text not null,
  "reason" text not null,
  "responsible_id" uuid,
  "deadline" date,
  "status" text default 'open'::text not null,
  "resolution_note" text,
  "resolved_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table public."board_columns" (
  "id" uuid default gen_random_uuid() not null,
  "board_id" uuid not null,
  "name" text not null,
  "color" text default '#2563EB'::text not null,
  "operational_status" text default 'not_started'::text not null,
  "position" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "automation_role" text
);

create table public."boards" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "description" text,
  "color" text default '#2563EB'::text not null,
  "status" text default 'active'::text not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "board_kind" text default 'custom'::text not null
);

create table public."calendar_event_history" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "actor_id" uuid,
  "action" text not null,
  "old_values" jsonb default '{}'::jsonb not null,
  "new_values" jsonb default '{}'::jsonb not null,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."calendar_events" (
  "id" uuid default uuid_generate_v4() not null,
  "title" text not null,
  "type" text default 'meeting'::text not null,
  "client_id" uuid,
  "work_item_id" uuid,
  "responsible_id" uuid,
  "starts_at" timestamp with time zone not null,
  "ends_at" timestamp with time zone not null,
  "location" text,
  "notes" text,
  "confirmed" boolean default false not null,
  "drive_link" text,
  "external_url" text,
  "google_event_id" text,
  "google_calendar_id" text,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "all_day" boolean default false not null,
  "color" text,
  "recurrence_rule" text,
  "source" text default 'internal'::text not null,
  "series_id" uuid,
  "series_sequence" integer default 0 not null,
  "recurrence_until" date,
  "auto_recurrence" boolean default false not null,
  "custom_name" text,
  "pauta_id" uuid,
  "completion_status" text default 'open'::text not null,
  "completed_at" timestamp with time zone,
  "completed_by" uuid,
  "completion_note" text
);

create table public."chat_messages" (
  "id" uuid default uuid_generate_v4() not null,
  "channel" text default 'geral'::text not null,
  "content" text not null,
  "author_id" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table public."client_services" (
  "id" uuid default uuid_generate_v4() not null,
  "client_id" uuid not null,
  "service_catalog_id" uuid not null,
  "responsible_id" uuid,
  "status" text default 'active'::text not null,
  "started_at" date,
  "notes" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "monthly_quantity" integer,
  "quantity_unit" text,
  "delivered_quantity" integer default 0 not null,
  "cycle_duration_days" integer,
  "requires_alignment_meeting" boolean default true not null,
  "requires_capture" boolean default true not null,
  "default_capture_type" text
);

create table public."clients" (
  "id" uuid default uuid_generate_v4() not null,
  "name" text not null,
  "segment" text default ''::text not null,
  "status" text default 'active'::text not null,
  "avatar_initials" text default 'CL'::text not null,
  "avatar_color" text default '#888888'::text not null,
  "avatar_bg" text default '#1A1A1A'::text not null,
  "responsible_id" uuid,
  "main_contact_name" text,
  "main_contact_email" text,
  "main_contact_phone" text,
  "drive_folder_url" text,
  "briefing_url" text,
  "last_report_url" text,
  "website" text,
  "instagram" text,
  "notes" text,
  "crm_client_id" text,
  "started_at" date,
  "ended_at" date,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "cnpj_cpf" text,
  "cidade" text,
  "metodo_pagamento" text,
  "notas_fiscais" text,
  "valor_mensal" numeric(10,2),
  "dia_vencimento" integer,
  "tempo_contrato" text,
  "inicio_contrato" date,
  "fim_contrato" date,
  "situacao_contrato" text,
  "observacoes_contrato" text,
  "logo_url" text,
  "logo_storage_path" text,
  "strategic_map_url" text,
  "operation_model" text default 'monthly'::text not null
);

create table public."comercial_config" (
  "key" text not null,
  "value" jsonb not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."comercial_formularios" (
  "id" bigint default nextval('comercial_formularios_id_seq'::regclass) not null,
  "response_id" text not null,
  "session_id" text,
  "dados" jsonb,
  "payload" jsonb,
  "created_at" timestamp with time zone default now() not null
);

create table public."comercial_leads" (
  "id" uuid default gen_random_uuid() not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "session_id" text not null,
  "canal" text default 'whatsapp'::text not null,
  "origem" text,
  "telefone" text,
  "nome" text,
  "empresa" text,
  "segmento" text,
  "cidade" text,
  "faturamento_faixa" text,
  "investe_marketing" text,
  "dor" text,
  "decisor" text,
  "urgencia" text,
  "temperatura" text,
  "pode_agendar" boolean default false not null,
  "status" text default 'em_conversa'::text not null,
  "email" text,
  "ad_id" text,
  "ctwa_clid" text,
  "campanha" text,
  "resumo" text,
  "colaboradores" integer,
  "marketing_hoje" text,
  "trafego_pago" text,
  "investimento_faixa" text,
  "score" integer,
  "score_detalhe" jsonb,
  "estagio" text,
  "pedido_tipo" text,
  "motivo_fora" text,
  "avaliacao" jsonb,
  "formulario_enviado_em" timestamp with time zone,
  "formulario_respondido_em" timestamp with time zone
);

create table public."comercial_mensagens" (
  "id" bigint generated always as identity not null,
  "session_id" text not null,
  "direcao" text not null,
  "texto" text not null,
  "wa_id" text,
  "processada" boolean default false not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."comercial_reunioes" (
  "id" uuid default gen_random_uuid() not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "lead_id" uuid not null,
  "inicio" timestamp with time zone not null,
  "fim" timestamp with time zone not null,
  "formato" text default 'online'::text not null,
  "status" text default 'agendada'::text not null,
  "responsavel" text,
  "google_event_id" text,
  "meet_link" text,
  "lembrete_24h_em" timestamp with time zone,
  "lembrete_2h_em" timestamp with time zone
);

create table public."feed_board_events" (
  "id" uuid default uuid_generate_v4() not null,
  "board_id" uuid not null,
  "item_id" uuid,
  "actor_type" text default 'internal'::text not null,
  "actor_id" uuid,
  "actor_name" text default 'Ampy Digital'::text not null,
  "event_type" text not null,
  "message" text not null,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."feed_board_item_assets" (
  "id" uuid default gen_random_uuid() not null,
  "board_id" uuid not null,
  "item_id" uuid not null,
  "asset_type" text default 'slide'::text not null,
  "position" integer default 0 not null,
  "title" text,
  "storage_path" text,
  "file_url" text not null,
  "mime_type" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."feed_board_items" (
  "id" uuid default uuid_generate_v4() not null,
  "board_id" uuid not null,
  "work_item_id" uuid,
  "position" integer default 0 not null,
  "title" text,
  "cover_url" text,
  "storage_path" text,
  "content_url" text,
  "caption" text,
  "internal_notes" text,
  "approval_status" text default 'pending'::text not null,
  "client_feedback" text,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "source_file_name" text,
  "scheduled_date" date,
  "scheduled_time" time without time zone,
  "content_type" text default 'post'::text not null,
  "workflow_status" text default 'awaiting_approval'::text not null
);

create table public."feed_boards" (
  "id" uuid default uuid_generate_v4() not null,
  "client_id" uuid not null,
  "title" text not null,
  "period_month" date not null,
  "status" text default 'draft'::text not null,
  "visual_preset" text default 'custom'::text not null,
  "share_token" text default replace((uuid_generate_v4())::text, '-'::text, ''::text) not null,
  "created_by" uuid,
  "notes" text,
  "published_at" timestamp with time zone,
  "last_client_action_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "drive_folder_url" text
);

create table public."feed_posts" (
  "id" uuid default uuid_generate_v4() not null,
  "client_id" uuid,
  "title" text,
  "date" date,
  "time" text default '09:00'::text,
  "status" text default 'draft'::text,
  "caption" text,
  "hashtags" text,
  "drive_link" text,
  "cover_url" text,
  "notes" text,
  "client_feedback" text,
  "approved_at" timestamp with time zone,
  "position" integer default 0,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table public."internal_message_mentions" (
  "id" uuid default gen_random_uuid() not null,
  "message_id" uuid not null,
  "mentioned_profile_id" uuid,
  "mentioned_team_member_id" uuid,
  "mentioned_email" text,
  "mentioned_area" text,
  "mentioned_role" text,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table public."internal_messages" (
  "id" uuid default gen_random_uuid() not null,
  "body" text not null,
  "context_type" text default 'general'::text not null,
  "context_id" uuid,
  "client_id" uuid,
  "work_item_id" uuid,
  "feed_board_id" uuid,
  "feed_board_item_id" uuid,
  "aviso_id" uuid,
  "drive_url" text,
  "attachment_title" text,
  "created_by_profile_id" uuid,
  "created_by_team_member_id" uuid,
  "created_by_email" text,
  "is_resolved" boolean default false not null,
  "resolved_at" timestamp with time zone,
  "resolved_by_profile_id" uuid,
  "resolved_by_team_member_id" uuid,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."meta_ad_accounts" (
  "id" uuid default uuid_generate_v4() not null,
  "client_id" uuid,
  "meta_account_id" text not null,
  "account_id" text,
  "name" text,
  "currency" text,
  "timezone_name" text,
  "account_status" integer,
  "is_selected" boolean default false not null,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "amount_spent_total" numeric(14,2),
  "balance" numeric(14,2),
  "spend_cap" numeric(14,2),
  "is_prepay_account" boolean,
  "billing_type" text,
  "payment_method_label" text,
  "funding_source_details" jsonb,
  "financial_synced_at" timestamp with time zone
);

create table public."meta_ad_creatives" (
  "meta_ad_id" text not null,
  "ad_account_id" uuid,
  "creative_id" text,
  "ad_name" text,
  "thumbnail_url" text,
  "image_url" text,
  "title" text,
  "body" text,
  "object_type" text,
  "synced_at" timestamp with time zone default now() not null
);

create table public."meta_ads" (
  "id" uuid default uuid_generate_v4() not null,
  "ad_account_id" uuid not null,
  "campaign_id" uuid,
  "adset_id" uuid,
  "meta_ad_id" text not null,
  "meta_campaign_id" text,
  "meta_adset_id" text,
  "name" text,
  "status" text,
  "effective_status" text,
  "creative_id" text,
  "meta_created_time" timestamp with time zone,
  "meta_updated_time" timestamp with time zone,
  "last_synced_at" timestamp with time zone default now() not null
);

create table public."meta_adsets" (
  "id" uuid default uuid_generate_v4() not null,
  "ad_account_id" uuid not null,
  "campaign_id" uuid,
  "meta_adset_id" text not null,
  "meta_campaign_id" text,
  "name" text,
  "status" text,
  "effective_status" text,
  "optimization_goal" text,
  "billing_event" text,
  "daily_budget" numeric,
  "lifetime_budget" numeric,
  "targeting" jsonb,
  "start_time" timestamp with time zone,
  "end_time" timestamp with time zone,
  "meta_created_time" timestamp with time zone,
  "meta_updated_time" timestamp with time zone,
  "last_synced_at" timestamp with time zone default now() not null
);

create table public."meta_campaigns" (
  "id" uuid default uuid_generate_v4() not null,
  "ad_account_id" uuid not null,
  "meta_campaign_id" text not null,
  "name" text,
  "status" text,
  "effective_status" text,
  "objective" text,
  "buying_type" text,
  "daily_budget" numeric,
  "lifetime_budget" numeric,
  "start_time" timestamp with time zone,
  "stop_time" timestamp with time zone,
  "meta_created_time" timestamp with time zone,
  "meta_updated_time" timestamp with time zone,
  "last_synced_at" timestamp with time zone default now() not null
);

create table public."meta_insights_daily" (
  "id" bigint generated by default as identity not null,
  "ad_account_id" uuid not null,
  "level" text not null,
  "entity_id" text not null,
  "entity_name" text,
  "date_start" date not null,
  "date_stop" date not null,
  "spend" numeric default 0 not null,
  "impressions" bigint default 0 not null,
  "reach" bigint default 0 not null,
  "frequency" numeric,
  "clicks" bigint default 0 not null,
  "inline_link_clicks" bigint default 0 not null,
  "ctr" numeric,
  "cpc" numeric,
  "cpm" numeric,
  "actions" jsonb default '[]'::jsonb not null,
  "action_values" jsonb default '[]'::jsonb not null,
  "cost_per_action_type" jsonb default '[]'::jsonb not null,
  "raw" jsonb default '{}'::jsonb not null,
  "synced_at" timestamp with time zone default now() not null,
  "meta_campaign_id" text,
  "meta_adset_id" text,
  "objective" text,
  "results" jsonb default '[]'::jsonb not null,
  "cost_per_result" jsonb default '[]'::jsonb not null,
  "result_indicator" text,
  "result_count" numeric
);

create table public."meta_period_insights" (
  "id" bigint default nextval('meta_period_insights_id_seq'::regclass) not null,
  "ad_account_id" uuid not null,
  "level" text not null,
  "entity_id" text not null,
  "entity_name" text,
  "meta_campaign_id" text,
  "since" date not null,
  "until" date not null,
  "objective" text,
  "spend" numeric,
  "impressions" bigint,
  "reach" bigint,
  "frequency" numeric,
  "clicks" bigint,
  "inline_link_clicks" bigint,
  "ctr" numeric,
  "cpc" numeric,
  "cpm" numeric,
  "actions" jsonb,
  "action_values" jsonb,
  "purchase_roas" jsonb,
  "results" jsonb,
  "result_indicator" text,
  "result_count" numeric,
  "raw" jsonb,
  "synced_at" timestamp with time zone default now() not null
);

create table public."meta_sync_runs" (
  "id" uuid default uuid_generate_v4() not null,
  "mode" text not null,
  "ad_account_id" uuid,
  "status" text not null,
  "started_at" timestamp with time zone default now() not null,
  "finished_at" timestamp with time zone,
  "rows_upserted" integer default 0 not null,
  "details" jsonb default '{}'::jsonb not null,
  "error_message" text
);

create table public."pauta_events" (
  "id" uuid default gen_random_uuid() not null,
  "pauta_id" uuid,
  "board_id" uuid,
  "actor_id" uuid,
  "action" text not null,
  "target_type" text default 'pauta'::text not null,
  "target_id" uuid,
  "old_values" jsonb default '{}'::jsonb not null,
  "new_values" jsonb default '{}'::jsonb not null,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."pauta_members" (
  "id" uuid default gen_random_uuid() not null,
  "pauta_id" uuid not null,
  "client_id" uuid not null,
  "main_work_item_id" uuid,
  "membership_status" text default 'active'::text not null,
  "source" text default 'added'::text not null,
  "added_by" uuid,
  "added_at" timestamp with time zone default now() not null,
  "removed_by" uuid,
  "removed_at" timestamp with time zone,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "target_date" date,
  "target_date_updated_at" timestamp with time zone,
  "target_date_updated_by" uuid
);

create table public."pautas" (
  "id" uuid default gen_random_uuid() not null,
  "board_id" uuid not null,
  "name" text not null,
  "reference_month" date not null,
  "magic_number_date" date not null,
  "scheduled_until_date" date not null,
  "lifecycle_status" text default 'draft'::text not null,
  "opened_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."profiles" (
  "id" uuid not null,
  "full_name" text not null,
  "email" text not null,
  "role" text default 'collaborator'::text not null,
  "avatar_initials" text default 'AM'::text not null,
  "avatar_color" text default '#888888'::text not null,
  "avatar_bg" text default '#1A1A1A'::text not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "team_area" text,
  "job_title" text,
  "display_name" text,
  "avatar_url" text
);

create table public."project_step_statuses" (
  "id" uuid default gen_random_uuid() not null,
  "work_item_id" uuid not null,
  "name" text not null,
  "color" text default '#64748B'::text not null,
  "behavior" text default 'pending'::text not null,
  "position" integer default 0 not null,
  "is_archived" boolean default false not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."project_steps" (
  "id" uuid default uuid_generate_v4() not null,
  "work_item_id" uuid,
  "title" text not null,
  "responsible_id" uuid,
  "start_date" date,
  "end_date" date,
  "status" text default 'not_started'::text,
  "position" integer default 0,
  "notes" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "status_id" uuid
);

create table public."projects" (
  "id" uuid default uuid_generate_v4() not null,
  "name" text not null,
  "type" text default 'recurring'::text not null,
  "client_id" uuid,
  "responsible_id" uuid,
  "status" text default 'active'::text not null,
  "description" text,
  "started_at" date,
  "deadline" date,
  "drive_folder_url" text,
  "crm_deal_id" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."resource_links" (
  "id" uuid default uuid_generate_v4() not null,
  "entity_type" text not null,
  "entity_id" uuid not null,
  "label" text not null,
  "url" text not null,
  "link_type" text default 'drive_folder'::text not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table public."service_catalog" (
  "id" uuid default uuid_generate_v4() not null,
  "name" text not null,
  "category" text not null,
  "description" text,
  "default_workflow" text[] default '{}'::text[] not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."team_access_audit" (
  "id" uuid default gen_random_uuid() not null,
  "actor_id" uuid,
  "target_profile_id" uuid,
  "target_email" text not null,
  "action" text not null,
  "old_values" jsonb default '{}'::jsonb not null,
  "new_values" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."team_members" (
  "id" uuid default gen_random_uuid() not null,
  "profile_id" uuid,
  "full_name" text not null,
  "email" text not null,
  "job_title" text not null,
  "access_type" text default 'operacional'::text not null,
  "operational_area" text not null,
  "avatar_initials" text,
  "avatar_color" text default '#FFFFFF'::text,
  "avatar_bg" text default '#3A3D43'::text,
  "is_active" boolean default true not null,
  "receives_internal_alerts" boolean default true not null,
  "display_order" integer,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "must_change_password" boolean default false not null,
  "last_password_change_at" timestamp with time zone,
  "last_access_change_at" timestamp with time zone,
  "last_access_changed_by" uuid,
  "display_name" text,
  "avatar_url" text
);

create table public."trafego_acoes" (
  "id" bigint default nextval('trafego_acoes_id_seq'::regclass) not null,
  "created_at" timestamp with time zone default now() not null,
  "execucao_id" bigint,
  "meta_account_id" text not null,
  "conta_nome" text,
  "nivel" text not null,
  "objeto_id" text not null,
  "objeto_nome" text,
  "tipo" text not null,
  "regra" text,
  "motivo" text,
  "antes" jsonb,
  "depois" jsonb,
  "metricas" jsonb,
  "status" text not null,
  "erro" text,
  "origem" text default 'diario'::text not null,
  "executado_at" timestamp with time zone,
  "desfeito_at" timestamp with time zone,
  "desfaz_acao_id" bigint
);

create table public."trafego_alertas" (
  "id" bigint default nextval('trafego_alertas_id_seq'::regclass) not null,
  "created_at" timestamp with time zone default now() not null,
  "execucao_id" bigint,
  "meta_account_id" text,
  "conta_nome" text,
  "tipo" text not null,
  "severidade" text not null,
  "mensagem" text not null,
  "dados" jsonb,
  "chave" text not null,
  "dia" date default ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date not null,
  "resolvido_at" timestamp with time zone
);

create table public."trafego_config" (
  "key" text not null,
  "value" jsonb not null,
  "descricao" text,
  "updated_at" timestamp with time zone default now() not null
);

create table public."trafego_contas" (
  "meta_account_id" text not null,
  "modo" text default 'executar'::text not null,
  "orcamento_mensal" numeric,
  "objetivo_negocio" text,
  "observacoes" text,
  "updated_at" timestamp with time zone default now() not null
);

create table public."trafego_execucoes" (
  "id" bigint default nextval('trafego_execucoes_id_seq'::regclass) not null,
  "started_at" timestamp with time zone default now() not null,
  "finished_at" timestamp with time zone,
  "origem" text default 'diario'::text not null,
  "modo" text not null,
  "periodo" jsonb,
  "resumo" jsonb,
  "texto_whatsapp" text,
  "texto_email" text,
  "erro" text
);

create table public."trafego_metas" (
  "id" uuid default gen_random_uuid() not null,
  "meta_account_id" text not null,
  "result_indicator" text default '*'::text not null,
  "nome_resultado" text,
  "cpr_alvo" numeric,
  "cpr_max" numeric,
  "roas_alvo" numeric,
  "observacoes" text,
  "updated_at" timestamp with time zone default now() not null
);

create table public."traffic_report_clients" (
  "id" uuid default gen_random_uuid() not null,
  "ad_account_id" uuid not null,
  "client_id" uuid,
  "display_name" text not null,
  "report_enabled" boolean default true not null,
  "recipients" text[],
  "cc" text[],
  "drive_client_folder_id" text,
  "drive_weekly_folder_id" text,
  "manager_name" text,
  "notes" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "sales_validated" boolean default false not null
);

create table public."traffic_report_deliveries" (
  "id" uuid default gen_random_uuid() not null,
  "report_client_id" uuid,
  "client_id" uuid,
  "ad_account_id" uuid,
  "client_name" text not null,
  "period_since" date not null,
  "period_until" date not null,
  "mode" text not null,
  "slides_file_id" text,
  "pdf_file_id" text,
  "pdf_file_name" text,
  "pdf_md5" text,
  "drive_folder_id" text,
  "recipient" text,
  "cc" text,
  "subject" text,
  "sent_at" timestamp with time zone,
  "gmail_message_id" text,
  "status" text not null,
  "error" text,
  "checks" jsonb,
  "created_at" timestamp with time zone default now() not null
);

create table public."traffic_report_settings" (
  "key" text not null,
  "value" jsonb not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."work_item_board_assignment_events" (
  "id" uuid default gen_random_uuid() not null,
  "assignment_id" uuid,
  "work_item_id" uuid not null,
  "pauta_id" uuid,
  "board_id" uuid,
  "board_column_id" uuid,
  "actor_id" uuid,
  "action" text not null,
  "old_values" jsonb default '{}'::jsonb not null,
  "new_values" jsonb default '{}'::jsonb not null,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."work_item_board_assignments" (
  "id" uuid default gen_random_uuid() not null,
  "work_item_id" uuid not null,
  "board_id" uuid not null,
  "board_column_id" uuid not null,
  "operational_status" text default 'not_started'::text not null,
  "is_required" boolean default true not null,
  "assignment_status" text default 'active'::text not null,
  "position" bigint default 0 not null,
  "assigned_by" uuid,
  "assigned_at" timestamp with time zone default now() not null,
  "completed_by" uuid,
  "completed_at" timestamp with time zone,
  "removed_by" uuid,
  "removed_at" timestamp with time zone,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."work_item_checklists" (
  "id" uuid default uuid_generate_v4() not null,
  "work_item_id" uuid not null,
  "title" text not null,
  "is_done" boolean default false not null,
  "done_by" uuid,
  "done_at" timestamp with time zone,
  "position" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."work_item_comments" (
  "id" uuid default uuid_generate_v4() not null,
  "work_item_id" uuid not null,
  "author_id" uuid not null,
  "content" text not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."work_item_history" (
  "id" uuid default uuid_generate_v4() not null,
  "work_item_id" uuid not null,
  "actor_id" uuid,
  "field_changed" text not null,
  "old_value" text,
  "new_value" text,
  "created_at" timestamp with time zone default now() not null
);

create table public."work_item_schedule_requirements" (
  "id" uuid default gen_random_uuid() not null,
  "work_item_id" uuid not null,
  "requirement_type" text not null,
  "status" text default 'pending'::text not null,
  "calendar_event_id" uuid,
  "created_by" uuid,
  "scheduled_at" timestamp with time zone,
  "confirmed_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "calendar_type" text
);

create table public."work_items" (
  "id" uuid default uuid_generate_v4() not null,
  "title" text not null,
  "description" text,
  "client_id" uuid,
  "client_service_id" uuid,
  "project_id" uuid,
  "type" text default 'task'::text not null,
  "origin" text default 'planned'::text not null,
  "status" text default 'not_started'::text not null,
  "priority" text default 'normal'::text not null,
  "responsible_id" uuid,
  "created_by" uuid,
  "internal_deadline" date,
  "final_deadline" date,
  "blocked_reason" text,
  "blocked_at" timestamp with time zone,
  "drive_link" text,
  "notes" text,
  "closed_at" timestamp with time zone,
  "close_reason" text,
  "crm_contract_id" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "destino" text default 'kanban'::text,
  "board_id" uuid,
  "board_column_id" uuid,
  "card_tag" text,
  "card_tag_color" text default 'slate'::text,
  "generated_from_cycle_id" uuid,
  "cycle_number" integer,
  "cycle_duration_days_snapshot" integer,
  "generated_at" timestamp with time zone,
  "generated_by" uuid,
  "pauta_id" uuid,
  "is_pauta_card" boolean default false not null,
  "pauta_card_id" uuid,
  "completed_at" timestamp with time zone,
  "completed_by" uuid,
  "completion_magic_number_snapshot" date,
  "completion_delay_days" integer,
  "content_finalized_at" timestamp with time zone,
  "content_finalized_by" uuid,
  "approvals_resolved_at" timestamp with time zone,
  "approvals_resolved_by" uuid,
  "programming_covered_until" date,
  "programming_verified_at" timestamp with time zone,
  "programming_verified_by" uuid,
  "briefing_link" text,
  "moodboard_link" text,
  "reference_link" text
);

alter table public."ampy_agentes" add constraint "ampy_agentes_pkey" PRIMARY KEY (slug);

alter table public."ampy_agentes" add constraint "ampy_agentes_status_check" CHECK ((status = ANY (ARRAY['ativo'::text, 'desligado'::text, 'sob_demanda'::text])));

alter table public."ampy_agentes" enable row level security;

CREATE UNIQUE INDEX ampy_agentes_pkey ON public.ampy_agentes USING btree (slug);

alter table public."approvals" add constraint "approvals_pkey" PRIMARY KEY (id);

alter table public."approvals" add constraint "approvals_sent_by_fkey" FOREIGN KEY (sent_by) REFERENCES profiles(id);

alter table public."approvals" add constraint "approvals_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'changes_requested'::text, 'cancelled'::text])));

alter table public."approvals" add constraint "approvals_work_item_id_fkey" FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE;

alter table public."approvals" enable row level security;

CREATE UNIQUE INDEX approvals_pkey ON public.approvals USING btree (id);

CREATE INDEX idx_approvals_work_item ON public.approvals USING btree (work_item_id);

CREATE INDEX idx_approvals_status ON public.approvals USING btree (status);

alter table public."audit_logs" add constraint "audit_logs_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES profiles(id);

alter table public."audit_logs" add constraint "audit_logs_pkey" PRIMARY KEY (id);

alter table public."audit_logs" enable row level security;

CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_id);

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);

alter table public."avisos" add constraint "avisos_assigned_team_member_id_fkey" FOREIGN KEY (assigned_team_member_id) REFERENCES team_members(id) ON DELETE SET NULL;

alter table public."avisos" add constraint "avisos_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."avisos" add constraint "avisos_category_check" CHECK ((category = ANY (ARRAY['approval'::text, 'adjustment'::text, 'demand'::text, 'planning'::text, 'agenda'::text, 'client'::text, 'project'::text, 'board'::text, 'communication'::text, 'manual'::text, 'operational'::text])));

alter table public."avisos" add constraint "avisos_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

alter table public."avisos" add constraint "avisos_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."avisos" add constraint "avisos_dedupe_key_key" UNIQUE (dedupe_key);

alter table public."avisos" add constraint "avisos_feed_board_event_id_fkey" FOREIGN KEY (feed_board_event_id) REFERENCES feed_board_events(id) ON DELETE SET NULL;

alter table public."avisos" add constraint "avisos_feed_board_id_fkey" FOREIGN KEY (feed_board_id) REFERENCES feed_boards(id) ON DELETE SET NULL;

alter table public."avisos" add constraint "avisos_feed_board_item_id_fkey" FOREIGN KEY (feed_board_item_id) REFERENCES feed_board_items(id) ON DELETE SET NULL;

alter table public."avisos" add constraint "avisos_pkey" PRIMARY KEY (id);

alter table public."avisos" add constraint "avisos_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])));

alter table public."avisos" add constraint "avisos_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'read'::text, 'archived'::text, 'deleted'::text, 'done'::text])));

alter table public."avisos" add constraint "avisos_work_item_id_fkey" FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE SET NULL;

alter table public."avisos" enable row level security;

CREATE UNIQUE INDEX avisos_pkey ON public.avisos USING btree (id);

CREATE UNIQUE INDEX avisos_dedupe_key_key ON public.avisos USING btree (dedupe_key);

CREATE INDEX idx_avisos_status ON public.avisos USING btree (status);

CREATE INDEX idx_avisos_category ON public.avisos USING btree (category);

CREATE INDEX idx_avisos_priority ON public.avisos USING btree (priority);

CREATE INDEX idx_avisos_client_id ON public.avisos USING btree (client_id);

CREATE INDEX idx_avisos_work_item_id ON public.avisos USING btree (work_item_id);

CREATE INDEX idx_avisos_feed_board_id ON public.avisos USING btree (feed_board_id);

CREATE INDEX idx_avisos_feed_board_item_id ON public.avisos USING btree (feed_board_item_id);

CREATE INDEX idx_avisos_due_at ON public.avisos USING btree (due_at);

CREATE INDEX idx_avisos_reminder_at ON public.avisos USING btree (reminder_at);

CREATE INDEX idx_avisos_deleted_at ON public.avisos USING btree (deleted_at);

CREATE INDEX idx_avisos_archived_at ON public.avisos USING btree (archived_at);

CREATE INDEX idx_avisos_related_entity ON public.avisos USING btree (related_entity_type, related_entity_id);

CREATE INDEX idx_avisos_assigned_team_member ON public.avisos USING btree (assigned_team_member_id);

CREATE INDEX idx_avisos_assigned_email ON public.avisos USING btree (assigned_email);

CREATE INDEX idx_avisos_assigned_area ON public.avisos USING btree (assigned_area);

alter table public."blockers" add constraint "blockers_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);

alter table public."blockers" add constraint "blockers_pkey" PRIMARY KEY (id);

alter table public."blockers" add constraint "blockers_responsible_id_fkey" FOREIGN KEY (responsible_id) REFERENCES profiles(id);

alter table public."blockers" add constraint "blockers_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'cancelled'::text])));

alter table public."blockers" add constraint "blockers_work_item_id_fkey" FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE;

alter table public."blockers" enable row level security;

CREATE UNIQUE INDEX blockers_pkey ON public.blockers USING btree (id);

CREATE INDEX idx_blockers_work_item ON public.blockers USING btree (work_item_id);

alter table public."board_columns" add constraint "board_columns_automation_role_check" CHECK (((automation_role IS NULL) OR (automation_role = ANY (ARRAY['alignment'::text, 'planning'::text, 'capture'::text, 'production'::text, 'organization'::text, 'approval'::text, 'programming'::text, 'completed'::text, 'legacy_metrics'::text]))));

alter table public."board_columns" add constraint "board_columns_board_id_fkey" FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table public."board_columns" add constraint "board_columns_board_id_id_key" UNIQUE (board_id, id);

alter table public."board_columns" add constraint "board_columns_name_check" CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 60)));

alter table public."board_columns" add constraint "board_columns_pkey" PRIMARY KEY (id);

alter table public."board_columns" add constraint "board_columns_status_check" CHECK ((operational_status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'waiting'::text, 'blocked'::text, 'in_review'::text, 'awaiting_approval'::text, 'approved'::text, 'scheduled'::text, 'delivered'::text, 'done'::text, 'cancelled'::text, 'archived'::text])));

alter table public."board_columns" enable row level security;

CREATE UNIQUE INDEX board_columns_pkey ON public.board_columns USING btree (id);

CREATE UNIQUE INDEX board_columns_name_unique ON public.board_columns USING btree (board_id, lower(TRIM(BOTH FROM name)));

CREATE INDEX idx_board_columns_board_position ON public.board_columns USING btree (board_id, "position");

CREATE UNIQUE INDEX board_columns_automation_role_unique ON public.board_columns USING btree (board_id, automation_role) WHERE (automation_role IS NOT NULL);

CREATE INDEX idx_board_columns_automation_role ON public.board_columns USING btree (automation_role);

CREATE UNIQUE INDEX board_columns_board_id_id_key ON public.board_columns USING btree (board_id, id);

alter table public."boards" add constraint "boards_board_kind_check" CHECK ((board_kind = ANY (ARRAY['pauta'::text, 'custom'::text])));

alter table public."boards" add constraint "boards_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."boards" add constraint "boards_name_check" CHECK (((char_length(TRIM(BOTH FROM name)) >= 2) AND (char_length(TRIM(BOTH FROM name)) <= 80)));

alter table public."boards" add constraint "boards_pkey" PRIMARY KEY (id);

alter table public."boards" add constraint "boards_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])));

alter table public."boards" enable row level security;

CREATE UNIQUE INDEX boards_pkey ON public.boards USING btree (id);

CREATE UNIQUE INDEX boards_active_name_unique ON public.boards USING btree (lower(TRIM(BOTH FROM name))) WHERE (status = 'active'::text);

CREATE INDEX idx_boards_status ON public.boards USING btree (status);

CREATE INDEX boards_board_kind_status_idx ON public.boards USING btree (board_kind, status);

alter table public."calendar_event_history" add constraint "calendar_event_history_actor_fk" FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."calendar_event_history" add constraint "calendar_event_history_event_fk" FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE;

alter table public."calendar_event_history" add constraint "calendar_event_history_pkey" PRIMARY KEY (id);

alter table public."calendar_event_history" enable row level security;

CREATE UNIQUE INDEX calendar_event_history_pkey ON public.calendar_event_history USING btree (id);

CREATE INDEX calendar_event_history_event_idx ON public.calendar_event_history USING btree (event_id, created_at DESC);

alter table public."calendar_events" add constraint "calendar_events_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id);

alter table public."calendar_events" add constraint "calendar_events_completed_by_fk" FOREIGN KEY (completed_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."calendar_events" add constraint "calendar_events_completion_state_chk" CHECK ((((completion_status = 'completed'::text) AND (completed_at IS NOT NULL)) OR ((completion_status = 'open'::text) AND (completed_at IS NULL) AND (completed_by IS NULL))));

alter table public."calendar_events" add constraint "calendar_events_completion_status_chk" CHECK ((completion_status = ANY (ARRAY['open'::text, 'completed'::text])));

alter table public."calendar_events" add constraint "calendar_events_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);

alter table public."calendar_events" add constraint "calendar_events_pauta_id_fkey" FOREIGN KEY (pauta_id) REFERENCES pautas(id) ON DELETE SET NULL;

alter table public."calendar_events" add constraint "calendar_events_pkey" PRIMARY KEY (id);

alter table public."calendar_events" add constraint "calendar_events_responsible_id_fkey" FOREIGN KEY (responsible_id) REFERENCES profiles(id);

alter table public."calendar_events" add constraint "calendar_events_type_check" CHECK ((type = ANY (ARRAY['meeting'::text, 'capture_external'::text, 'capture_studio'::text, 'recording'::text, 'delivery'::text, 'internal'::text, 'commercial'::text, 'reu_a'::text, 'reu_c'::text, 'cap_e'::text, 'cap_s'::text, 'out_a'::text])));

alter table public."calendar_events" add constraint "calendar_events_work_item_id_fkey" FOREIGN KEY (work_item_id) REFERENCES work_items(id);

alter table public."calendar_events" enable row level security;

CREATE UNIQUE INDEX calendar_events_pkey ON public.calendar_events USING btree (id);

CREATE INDEX idx_calendar_events_starts_at ON public.calendar_events USING btree (starts_at);

CREATE INDEX idx_calendar_events_client ON public.calendar_events USING btree (client_id);

CREATE INDEX idx_calendar_events_responsible ON public.calendar_events USING btree (responsible_id);

CREATE INDEX idx_calendar_events_work_item ON public.calendar_events USING btree (work_item_id);

CREATE INDEX calendar_events_series_id_idx ON public.calendar_events USING btree (series_id) WHERE (series_id IS NOT NULL);

CREATE INDEX calendar_events_series_start_idx ON public.calendar_events USING btree (series_id, starts_at) WHERE (series_id IS NOT NULL);

CREATE INDEX idx_calendar_events_work_item_type ON public.calendar_events USING btree (work_item_id, type) WHERE (work_item_id IS NOT NULL);

CREATE INDEX calendar_events_pauta_id_idx ON public.calendar_events USING btree (pauta_id, starts_at);

CREATE INDEX calendar_events_completion_idx ON public.calendar_events USING btree (completion_status, completed_at);

alter table public."chat_messages" add constraint "chat_messages_author_id_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id);

alter table public."chat_messages" add constraint "chat_messages_pkey" PRIMARY KEY (id);

alter table public."chat_messages" enable row level security;

CREATE UNIQUE INDEX chat_messages_pkey ON public.chat_messages USING btree (id);

CREATE INDEX idx_chat_messages_channel ON public.chat_messages USING btree (channel);

CREATE INDEX idx_chat_messages_created ON public.chat_messages USING btree (created_at);

alter table public."client_services" add constraint "client_services_capture_configuration_check" CHECK ((requires_capture OR (default_capture_type IS NULL)));

alter table public."client_services" add constraint "client_services_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table public."client_services" add constraint "client_services_cycle_duration_days_check" CHECK (((cycle_duration_days IS NULL) OR ((cycle_duration_days >= 1) AND (cycle_duration_days <= 365))));

alter table public."client_services" add constraint "client_services_default_capture_type_check" CHECK (((default_capture_type IS NULL) OR (default_capture_type = ANY (ARRAY['cap_e'::text, 'cap_s'::text]))));

alter table public."client_services" add constraint "client_services_delivered_quantity_check" CHECK ((delivered_quantity >= 0));

alter table public."client_services" add constraint "client_services_monthly_quantity_check" CHECK (((monthly_quantity IS NULL) OR (monthly_quantity >= 0)));

alter table public."client_services" add constraint "client_services_pkey" PRIMARY KEY (id);

alter table public."client_services" add constraint "client_services_responsible_id_fkey" FOREIGN KEY (responsible_id) REFERENCES profiles(id);

alter table public."client_services" add constraint "client_services_service_catalog_id_fkey" FOREIGN KEY (service_catalog_id) REFERENCES service_catalog(id);

alter table public."client_services" add constraint "client_services_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'cancelled'::text])));

alter table public."client_services" enable row level security;

CREATE UNIQUE INDEX client_services_pkey ON public.client_services USING btree (id);

alter table public."clients" add constraint "clients_operation_model_check" CHECK ((operation_model = ANY (ARRAY['monthly'::text, 'parallel'::text, 'not_applicable'::text])));

alter table public."clients" add constraint "clients_pkey" PRIMARY KEY (id);

alter table public."clients" add constraint "clients_responsible_id_fkey" FOREIGN KEY (responsible_id) REFERENCES profiles(id);

alter table public."clients" add constraint "clients_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text, 'onboarding'::text, 'paused'::text, 'archived'::text, 'inactive'::text])));

alter table public."clients" enable row level security;

CREATE UNIQUE INDEX clients_pkey ON public.clients USING btree (id);

alter table public."comercial_config" add constraint "comercial_config_pkey" PRIMARY KEY (key);

alter table public."comercial_config" enable row level security;

CREATE UNIQUE INDEX comercial_config_pkey ON public.comercial_config USING btree (key);

alter table public."comercial_formularios" add constraint "comercial_formularios_pkey" PRIMARY KEY (id);

alter table public."comercial_formularios" add constraint "comercial_formularios_response_id_key" UNIQUE (response_id);

alter table public."comercial_formularios" enable row level security;

CREATE UNIQUE INDEX comercial_formularios_pkey ON public.comercial_formularios USING btree (id);

CREATE UNIQUE INDEX comercial_formularios_response_id_key ON public.comercial_formularios USING btree (response_id);

alter table public."comercial_leads" add constraint "comercial_leads_canal_check" CHECK ((canal = ANY (ARRAY['whatsapp'::text, 'teste_n8n'::text, 'formulario'::text])));

alter table public."comercial_leads" add constraint "comercial_leads_colaboradores_check" CHECK ((colaboradores >= 0));

alter table public."comercial_leads" add constraint "comercial_leads_decisor_check" CHECK ((decisor = ANY (ARRAY['sim'::text, 'nao'::text, 'participa'::text])));

alter table public."comercial_leads" add constraint "comercial_leads_estagio_check" CHECK ((estagio = ANY (ARRAY['operando'::text, 'abrindo'::text, 'pessoa_fisica'::text])));

alter table public."comercial_leads" add constraint "comercial_leads_faturamento_faixa_check" CHECK ((faturamento_faixa = ANY (ARRAY['ate_20k'::text, '20k_50k'::text, '50k_100k'::text, 'acima_100k'::text])));

alter table public."comercial_leads" add constraint "comercial_leads_origem_check" CHECK ((origem = ANY (ARRAY['anuncio'::text, 'formulario'::text, 'organico'::text, 'teste'::text])));

alter table public."comercial_leads" add constraint "comercial_leads_pedido_tipo_check" CHECK ((pedido_tipo = ANY (ARRAY['recorrente'::text, 'avulso'::text])));

alter table public."comercial_leads" add constraint "comercial_leads_pkey" PRIMARY KEY (id);

alter table public."comercial_leads" add constraint "comercial_leads_session_id_key" UNIQUE (session_id);

alter table public."comercial_leads" add constraint "comercial_leads_status_check" CHECK ((status = ANY (ARRAY['em_conversa'::text, 'qualificado'::text, 'agendado'::text, 'desqualificado'::text, 'sem_resposta'::text, 'humano'::text, 'compareceu'::text, 'nao_compareceu'::text])));

alter table public."comercial_leads" add constraint "comercial_leads_temperatura_check" CHECK ((temperatura = ANY (ARRAY['quente'::text, 'morno'::text, 'frio'::text])));

alter table public."comercial_leads" add constraint "comercial_leads_urgencia_check" CHECK ((urgencia = ANY (ARRAY['imediato'::text, '30_dias'::text, '90_dias'::text, 'sem_prazo'::text])));

alter table public."comercial_leads" enable row level security;

CREATE UNIQUE INDEX comercial_leads_pkey ON public.comercial_leads USING btree (id);

CREATE UNIQUE INDEX comercial_leads_session_id_key ON public.comercial_leads USING btree (session_id);

alter table public."comercial_mensagens" add constraint "comercial_mensagens_direcao_check" CHECK ((direcao = ANY (ARRAY['lead'::text, 'alfredo'::text, 'humano'::text])));

alter table public."comercial_mensagens" add constraint "comercial_mensagens_pkey" PRIMARY KEY (id);

alter table public."comercial_mensagens" add constraint "comercial_mensagens_wa_id_key" UNIQUE (wa_id);

alter table public."comercial_mensagens" enable row level security;

CREATE UNIQUE INDEX comercial_mensagens_pkey ON public.comercial_mensagens USING btree (id);

CREATE UNIQUE INDEX comercial_mensagens_wa_id_key ON public.comercial_mensagens USING btree (wa_id);

CREATE INDEX comercial_mensagens_sessao_idx ON public.comercial_mensagens USING btree (session_id, id);

alter table public."comercial_reunioes" add constraint "comercial_reunioes_formato_check" CHECK ((formato = ANY (ARRAY['online'::text, 'presencial'::text])));

alter table public."comercial_reunioes" add constraint "comercial_reunioes_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES comercial_leads(id) ON DELETE CASCADE;

alter table public."comercial_reunioes" add constraint "comercial_reunioes_pkey" PRIMARY KEY (id);

alter table public."comercial_reunioes" add constraint "comercial_reunioes_status_check" CHECK ((status = ANY (ARRAY['agendada'::text, 'confirmada'::text, 'reagendada'::text, 'cancelada'::text, 'realizada'::text, 'no_show'::text])));

alter table public."comercial_reunioes" enable row level security;

CREATE UNIQUE INDEX comercial_reunioes_pkey ON public.comercial_reunioes USING btree (id);

CREATE UNIQUE INDEX comercial_reunioes_slot_ativo ON public.comercial_reunioes USING btree (inicio) WHERE (status = ANY (ARRAY['agendada'::text, 'confirmada'::text]));

CREATE INDEX comercial_reunioes_lead ON public.comercial_reunioes USING btree (lead_id);

alter table public."feed_board_events" add constraint "feed_board_events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."feed_board_events" add constraint "feed_board_events_actor_type_check" CHECK ((actor_type = ANY (ARRAY['internal'::text, 'client'::text, 'system'::text])));

alter table public."feed_board_events" add constraint "feed_board_events_board_id_fkey" FOREIGN KEY (board_id) REFERENCES feed_boards(id) ON DELETE CASCADE;

alter table public."feed_board_events" add constraint "feed_board_events_item_id_fkey" FOREIGN KEY (item_id) REFERENCES feed_board_items(id) ON DELETE SET NULL;

alter table public."feed_board_events" add constraint "feed_board_events_pkey" PRIMARY KEY (id);

alter table public."feed_board_events" enable row level security;

CREATE UNIQUE INDEX feed_board_events_pkey ON public.feed_board_events USING btree (id);

CREATE INDEX idx_feed_board_events_board ON public.feed_board_events USING btree (board_id);

CREATE INDEX idx_feed_board_events_item ON public.feed_board_events USING btree (item_id);

CREATE INDEX idx_feed_board_events_actor ON public.feed_board_events USING btree (actor_id);

CREATE INDEX idx_feed_board_events_created_at ON public.feed_board_events USING btree (created_at);

alter table public."feed_board_item_assets" add constraint "feed_board_item_assets_asset_type_check" CHECK ((asset_type = ANY (ARRAY['slide'::text, 'cover'::text, 'video'::text, 'file'::text])));

alter table public."feed_board_item_assets" add constraint "feed_board_item_assets_board_id_fkey" FOREIGN KEY (board_id) REFERENCES feed_boards(id) ON DELETE CASCADE;

alter table public."feed_board_item_assets" add constraint "feed_board_item_assets_item_id_fkey" FOREIGN KEY (item_id) REFERENCES feed_board_items(id) ON DELETE CASCADE;

alter table public."feed_board_item_assets" add constraint "feed_board_item_assets_pkey" PRIMARY KEY (id);

alter table public."feed_board_item_assets" enable row level security;

CREATE UNIQUE INDEX feed_board_item_assets_pkey ON public.feed_board_item_assets USING btree (id);

CREATE INDEX feed_board_item_assets_board_id_idx ON public.feed_board_item_assets USING btree (board_id);

CREATE INDEX feed_board_item_assets_item_id_position_idx ON public.feed_board_item_assets USING btree (item_id, "position");

alter table public."feed_board_items" add constraint "feed_board_items_approval_status_check" CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'changes_requested'::text, 'rejected'::text])));

alter table public."feed_board_items" add constraint "feed_board_items_board_id_fkey" FOREIGN KEY (board_id) REFERENCES feed_boards(id) ON DELETE CASCADE;

alter table public."feed_board_items" add constraint "feed_board_items_content_type_check" CHECK ((content_type = ANY (ARRAY['post'::text, 'video'::text, 'carousel'::text])));

alter table public."feed_board_items" add constraint "feed_board_items_pkey" PRIMARY KEY (id);

alter table public."feed_board_items" add constraint "feed_board_items_position_check" CHECK (("position" >= 0));

alter table public."feed_board_items" add constraint "feed_board_items_work_item_id_fkey" FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE SET NULL;

alter table public."feed_board_items" add constraint "feed_board_items_workflow_status_check" CHECK ((workflow_status = ANY (ARRAY['awaiting_approval'::text, 'approved'::text, 'changes_requested'::text, 'scheduled'::text])));

alter table public."feed_board_items" enable row level security;

CREATE UNIQUE INDEX feed_board_items_pkey ON public.feed_board_items USING btree (id);

CREATE INDEX idx_feed_board_items_board ON public.feed_board_items USING btree (board_id);

CREATE INDEX idx_feed_board_items_work_item ON public.feed_board_items USING btree (work_item_id);

CREATE INDEX idx_feed_board_items_position ON public.feed_board_items USING btree (board_id, "position");

CREATE INDEX idx_feed_board_items_approval_status ON public.feed_board_items USING btree (approval_status);

CREATE INDEX idx_feed_board_items_workflow_status ON public.feed_board_items USING btree (workflow_status);

alter table public."feed_boards" add constraint "feed_boards_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table public."feed_boards" add constraint "feed_boards_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."feed_boards" add constraint "feed_boards_period_month_check" CHECK ((period_month = (date_trunc('month'::text, (period_month)::timestamp without time zone))::date));

alter table public."feed_boards" add constraint "feed_boards_pkey" PRIMARY KEY (id);

alter table public."feed_boards" add constraint "feed_boards_share_token_unique" UNIQUE (share_token);

alter table public."feed_boards" add constraint "feed_boards_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'in_progress'::text, 'sent'::text, 'approved'::text, 'changes_requested'::text, 'archived'::text])));

alter table public."feed_boards" add constraint "feed_boards_visual_preset_check" CHECK ((visual_preset = ANY (ARRAY['custom'::text, 'standard'::text, 'minimalist'::text, 'creative'::text, 'neutral'::text, 'bold'::text])));

alter table public."feed_boards" enable row level security;

CREATE UNIQUE INDEX feed_boards_pkey ON public.feed_boards USING btree (id);

CREATE UNIQUE INDEX feed_boards_share_token_unique ON public.feed_boards USING btree (share_token);

CREATE INDEX idx_feed_boards_client ON public.feed_boards USING btree (client_id);

CREATE INDEX idx_feed_boards_status ON public.feed_boards USING btree (status);

CREATE INDEX idx_feed_boards_period_month ON public.feed_boards USING btree (period_month);

CREATE INDEX idx_feed_boards_share_token ON public.feed_boards USING btree (share_token);

CREATE INDEX idx_feed_boards_created_by ON public.feed_boards USING btree (created_by);

alter table public."feed_posts" add constraint "feed_posts_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table public."feed_posts" add constraint "feed_posts_pkey" PRIMARY KEY (id);

alter table public."feed_posts" enable row level security;

CREATE UNIQUE INDEX feed_posts_pkey ON public.feed_posts USING btree (id);

CREATE INDEX idx_feed_posts_client ON public.feed_posts USING btree (client_id);

CREATE INDEX idx_feed_posts_date ON public.feed_posts USING btree (date);

alter table public."internal_message_mentions" add constraint "internal_message_mentions_mentioned_profile_id_fkey" FOREIGN KEY (mentioned_profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public."internal_message_mentions" add constraint "internal_message_mentions_mentioned_team_member_id_fkey" FOREIGN KEY (mentioned_team_member_id) REFERENCES team_members(id) ON DELETE CASCADE;

alter table public."internal_message_mentions" add constraint "internal_message_mentions_message_id_fkey" FOREIGN KEY (message_id) REFERENCES internal_messages(id) ON DELETE CASCADE;

alter table public."internal_message_mentions" add constraint "internal_message_mentions_pkey" PRIMARY KEY (id);

alter table public."internal_message_mentions" enable row level security;

CREATE UNIQUE INDEX internal_message_mentions_pkey ON public.internal_message_mentions USING btree (id);

CREATE INDEX idx_internal_message_mentions_message ON public.internal_message_mentions USING btree (message_id);

CREATE INDEX idx_internal_message_mentions_profile ON public.internal_message_mentions USING btree (mentioned_profile_id);

CREATE INDEX idx_internal_message_mentions_team_member ON public.internal_message_mentions USING btree (mentioned_team_member_id);

CREATE INDEX idx_internal_message_mentions_email ON public.internal_message_mentions USING btree (mentioned_email);

CREATE INDEX idx_internal_message_mentions_area ON public.internal_message_mentions USING btree (mentioned_area);

alter table public."internal_messages" add constraint "internal_messages_aviso_id_fkey" FOREIGN KEY (aviso_id) REFERENCES avisos(id) ON DELETE SET NULL;

alter table public."internal_messages" add constraint "internal_messages_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

alter table public."internal_messages" add constraint "internal_messages_created_by_profile_id_fkey" FOREIGN KEY (created_by_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."internal_messages" add constraint "internal_messages_created_by_team_member_id_fkey" FOREIGN KEY (created_by_team_member_id) REFERENCES team_members(id) ON DELETE SET NULL;

alter table public."internal_messages" add constraint "internal_messages_feed_board_id_fkey" FOREIGN KEY (feed_board_id) REFERENCES feed_boards(id) ON DELETE SET NULL;

alter table public."internal_messages" add constraint "internal_messages_feed_board_item_id_fkey" FOREIGN KEY (feed_board_item_id) REFERENCES feed_board_items(id) ON DELETE SET NULL;

alter table public."internal_messages" add constraint "internal_messages_pkey" PRIMARY KEY (id);

alter table public."internal_messages" add constraint "internal_messages_resolved_by_profile_id_fkey" FOREIGN KEY (resolved_by_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."internal_messages" add constraint "internal_messages_resolved_by_team_member_id_fkey" FOREIGN KEY (resolved_by_team_member_id) REFERENCES team_members(id) ON DELETE SET NULL;

alter table public."internal_messages" add constraint "internal_messages_work_item_id_fkey" FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE SET NULL;

alter table public."internal_messages" enable row level security;

CREATE UNIQUE INDEX internal_messages_pkey ON public.internal_messages USING btree (id);

CREATE INDEX idx_internal_messages_context ON public.internal_messages USING btree (context_type, context_id);

CREATE INDEX idx_internal_messages_client ON public.internal_messages USING btree (client_id);

CREATE INDEX idx_internal_messages_work_item ON public.internal_messages USING btree (work_item_id);

CREATE INDEX idx_internal_messages_feed_board ON public.internal_messages USING btree (feed_board_id);

CREATE INDEX idx_internal_messages_created_team_member ON public.internal_messages USING btree (created_by_team_member_id);

CREATE INDEX idx_internal_messages_created_email ON public.internal_messages USING btree (created_by_email);

alter table public."meta_ad_accounts" add constraint "meta_ad_accounts_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

alter table public."meta_ad_accounts" add constraint "meta_ad_accounts_meta_account_id_key" UNIQUE (meta_account_id);

alter table public."meta_ad_accounts" add constraint "meta_ad_accounts_pkey" PRIMARY KEY (id);

alter table public."meta_ad_accounts" enable row level security;

CREATE UNIQUE INDEX meta_ad_accounts_pkey ON public.meta_ad_accounts USING btree (id);

CREATE UNIQUE INDEX meta_ad_accounts_meta_account_id_key ON public.meta_ad_accounts USING btree (meta_account_id);

CREATE INDEX meta_ad_accounts_client_id_idx ON public.meta_ad_accounts USING btree (client_id);

alter table public."meta_ad_creatives" add constraint "meta_ad_creatives_ad_account_id_fkey" FOREIGN KEY (ad_account_id) REFERENCES meta_ad_accounts(id) ON DELETE CASCADE;

alter table public."meta_ad_creatives" add constraint "meta_ad_creatives_pkey" PRIMARY KEY (meta_ad_id);

alter table public."meta_ad_creatives" enable row level security;

CREATE UNIQUE INDEX meta_ad_creatives_pkey ON public.meta_ad_creatives USING btree (meta_ad_id);

alter table public."meta_ads" add constraint "meta_ads_ad_account_id_fkey" FOREIGN KEY (ad_account_id) REFERENCES meta_ad_accounts(id) ON DELETE CASCADE;

alter table public."meta_ads" add constraint "meta_ads_adset_id_fkey" FOREIGN KEY (adset_id) REFERENCES meta_adsets(id) ON DELETE CASCADE;

alter table public."meta_ads" add constraint "meta_ads_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES meta_campaigns(id) ON DELETE CASCADE;

alter table public."meta_ads" add constraint "meta_ads_meta_ad_id_key" UNIQUE (meta_ad_id);

alter table public."meta_ads" add constraint "meta_ads_pkey" PRIMARY KEY (id);

alter table public."meta_ads" enable row level security;

CREATE UNIQUE INDEX meta_ads_pkey ON public.meta_ads USING btree (id);

CREATE UNIQUE INDEX meta_ads_meta_ad_id_key ON public.meta_ads USING btree (meta_ad_id);

CREATE INDEX meta_ads_account_idx ON public.meta_ads USING btree (ad_account_id);

alter table public."meta_adsets" add constraint "meta_adsets_ad_account_id_fkey" FOREIGN KEY (ad_account_id) REFERENCES meta_ad_accounts(id) ON DELETE CASCADE;

alter table public."meta_adsets" add constraint "meta_adsets_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES meta_campaigns(id) ON DELETE CASCADE;

alter table public."meta_adsets" add constraint "meta_adsets_meta_adset_id_key" UNIQUE (meta_adset_id);

alter table public."meta_adsets" add constraint "meta_adsets_pkey" PRIMARY KEY (id);

alter table public."meta_adsets" enable row level security;

CREATE UNIQUE INDEX meta_adsets_pkey ON public.meta_adsets USING btree (id);

CREATE UNIQUE INDEX meta_adsets_meta_adset_id_key ON public.meta_adsets USING btree (meta_adset_id);

CREATE INDEX meta_adsets_account_idx ON public.meta_adsets USING btree (ad_account_id);

alter table public."meta_campaigns" add constraint "meta_campaigns_ad_account_id_fkey" FOREIGN KEY (ad_account_id) REFERENCES meta_ad_accounts(id) ON DELETE CASCADE;

alter table public."meta_campaigns" add constraint "meta_campaigns_meta_campaign_id_key" UNIQUE (meta_campaign_id);

alter table public."meta_campaigns" add constraint "meta_campaigns_pkey" PRIMARY KEY (id);

alter table public."meta_campaigns" enable row level security;

CREATE UNIQUE INDEX meta_campaigns_pkey ON public.meta_campaigns USING btree (id);

CREATE UNIQUE INDEX meta_campaigns_meta_campaign_id_key ON public.meta_campaigns USING btree (meta_campaign_id);

CREATE INDEX meta_campaigns_account_idx ON public.meta_campaigns USING btree (ad_account_id);

alter table public."meta_insights_daily" add constraint "meta_insights_daily_ad_account_id_fkey" FOREIGN KEY (ad_account_id) REFERENCES meta_ad_accounts(id) ON DELETE CASCADE;

alter table public."meta_insights_daily" add constraint "meta_insights_daily_ad_account_id_level_entity_id_date_star_key" UNIQUE (ad_account_id, level, entity_id, date_start, date_stop);

alter table public."meta_insights_daily" add constraint "meta_insights_daily_level_check" CHECK ((level = ANY (ARRAY['account'::text, 'campaign'::text, 'adset'::text, 'ad'::text])));

alter table public."meta_insights_daily" add constraint "meta_insights_daily_pkey" PRIMARY KEY (id);

alter table public."meta_insights_daily" enable row level security;

CREATE INDEX meta_insights_daily_campaign_idx ON public.meta_insights_daily USING btree (meta_campaign_id, date_start DESC);

CREATE UNIQUE INDEX meta_insights_daily_pkey ON public.meta_insights_daily USING btree (id);

CREATE UNIQUE INDEX meta_insights_daily_ad_account_id_level_entity_id_date_star_key ON public.meta_insights_daily USING btree (ad_account_id, level, entity_id, date_start, date_stop);

CREATE INDEX meta_insights_daily_account_date_idx ON public.meta_insights_daily USING btree (ad_account_id, date_start DESC);

CREATE INDEX meta_insights_daily_level_entity_idx ON public.meta_insights_daily USING btree (level, entity_id, date_start DESC);

alter table public."meta_period_insights" add constraint "meta_period_insights_ad_account_id_fkey" FOREIGN KEY (ad_account_id) REFERENCES meta_ad_accounts(id) ON DELETE CASCADE;

alter table public."meta_period_insights" add constraint "meta_period_insights_ad_account_id_level_entity_id_since_un_key" UNIQUE (ad_account_id, level, entity_id, since, until);

alter table public."meta_period_insights" add constraint "meta_period_insights_pkey" PRIMARY KEY (id);

alter table public."meta_period_insights" enable row level security;

CREATE UNIQUE INDEX meta_period_insights_pkey ON public.meta_period_insights USING btree (id);

CREATE UNIQUE INDEX meta_period_insights_ad_account_id_level_entity_id_since_un_key ON public.meta_period_insights USING btree (ad_account_id, level, entity_id, since, until);

alter table public."meta_sync_runs" add constraint "meta_sync_runs_ad_account_id_fkey" FOREIGN KEY (ad_account_id) REFERENCES meta_ad_accounts(id) ON DELETE SET NULL;

alter table public."meta_sync_runs" add constraint "meta_sync_runs_mode_check" CHECK ((mode = ANY (ARRAY['discover'::text, 'sync'::text])));

alter table public."meta_sync_runs" add constraint "meta_sync_runs_pkey" PRIMARY KEY (id);

alter table public."meta_sync_runs" add constraint "meta_sync_runs_status_check" CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'partial'::text, 'error'::text])));

alter table public."meta_sync_runs" enable row level security;

CREATE UNIQUE INDEX meta_sync_runs_pkey ON public.meta_sync_runs USING btree (id);

alter table public."pauta_events" add constraint "pauta_events_action_chk" CHECK (((char_length(TRIM(BOTH FROM action)) >= 2) AND (char_length(TRIM(BOTH FROM action)) <= 80)));

alter table public."pauta_events" add constraint "pauta_events_actor_fk" FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."pauta_events" add constraint "pauta_events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."pauta_events" add constraint "pauta_events_board_fk" FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL;

alter table public."pauta_events" add constraint "pauta_events_board_id_fkey" FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL;

alter table public."pauta_events" add constraint "pauta_events_pauta_fk" FOREIGN KEY (pauta_id) REFERENCES pautas(id) ON DELETE SET NULL;

alter table public."pauta_events" add constraint "pauta_events_pauta_id_fkey" FOREIGN KEY (pauta_id) REFERENCES pautas(id) ON DELETE SET NULL;

alter table public."pauta_events" add constraint "pauta_events_pkey" PRIMARY KEY (id);

alter table public."pauta_events" add constraint "pauta_events_target_type_chk" CHECK ((target_type = ANY (ARRAY['pauta'::text, 'client'::text, 'work_item'::text, 'member'::text, 'board'::text])));

alter table public."pauta_events" enable row level security;

CREATE UNIQUE INDEX pauta_events_pkey ON public.pauta_events USING btree (id);

CREATE INDEX pauta_events_pauta_created_idx ON public.pauta_events USING btree (pauta_id, created_at DESC);

CREATE INDEX pauta_events_board_created_idx ON public.pauta_events USING btree (board_id, created_at DESC);

CREATE INDEX pauta_events_actor_created_idx ON public.pauta_events USING btree (actor_id, created_at DESC);

CREATE INDEX pauta_events_action_created_idx ON public.pauta_events USING btree (action, created_at DESC);

CREATE INDEX pauta_events_target_idx ON public.pauta_events USING btree (target_type, target_id);

alter table public."pauta_members" add constraint "pauta_members_added_by_fk" FOREIGN KEY (added_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."pauta_members" add constraint "pauta_members_added_by_fkey" FOREIGN KEY (added_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."pauta_members" add constraint "pauta_members_client_fk" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;

alter table public."pauta_members" add constraint "pauta_members_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;

alter table public."pauta_members" add constraint "pauta_members_main_work_item_fk" FOREIGN KEY (main_work_item_id) REFERENCES work_items(id) ON DELETE SET NULL;

alter table public."pauta_members" add constraint "pauta_members_main_work_item_id_fkey" FOREIGN KEY (main_work_item_id) REFERENCES work_items(id) ON DELETE SET NULL;

alter table public."pauta_members" add constraint "pauta_members_pauta_fk" FOREIGN KEY (pauta_id) REFERENCES pautas(id) ON DELETE CASCADE;

alter table public."pauta_members" add constraint "pauta_members_pauta_id_fkey" FOREIGN KEY (pauta_id) REFERENCES pautas(id) ON DELETE CASCADE;

alter table public."pauta_members" add constraint "pauta_members_pkey" PRIMARY KEY (id);

alter table public."pauta_members" add constraint "pauta_members_removed_by_fk" FOREIGN KEY (removed_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."pauta_members" add constraint "pauta_members_removed_by_fkey" FOREIGN KEY (removed_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."pauta_members" add constraint "pauta_members_removed_state_chk" CHECK ((((membership_status = 'active'::text) AND (removed_at IS NULL)) OR ((membership_status = 'removed'::text) AND (removed_at IS NOT NULL))));

alter table public."pauta_members" add constraint "pauta_members_source_chk" CHECK ((source = ANY (ARRAY['opened'::text, 'added'::text, 'legacy_adopted'::text, 'backfill'::text, 'restored'::text])));

alter table public."pauta_members" add constraint "pauta_members_status_chk" CHECK ((membership_status = ANY (ARRAY['active'::text, 'removed'::text])));

alter table public."pauta_members" add constraint "pauta_members_target_date_updated_by_fkey" FOREIGN KEY (target_date_updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."pauta_members" enable row level security;

CREATE UNIQUE INDEX pauta_members_pkey ON public.pauta_members USING btree (id);

CREATE UNIQUE INDEX pauta_members_active_client_uidx ON public.pauta_members USING btree (pauta_id, client_id) WHERE (membership_status = 'active'::text);

CREATE UNIQUE INDEX pauta_members_active_main_work_item_uidx ON public.pauta_members USING btree (main_work_item_id) WHERE ((membership_status = 'active'::text) AND (main_work_item_id IS NOT NULL));

CREATE INDEX pauta_members_pauta_status_idx ON public.pauta_members USING btree (pauta_id, membership_status);

CREATE INDEX pauta_members_client_status_idx ON public.pauta_members USING btree (client_id, membership_status);

CREATE INDEX pauta_members_added_at_idx ON public.pauta_members USING btree (added_at DESC);

CREATE INDEX pauta_members_target_date_idx ON public.pauta_members USING btree (pauta_id, target_date) WHERE (membership_status = 'active'::text);

alter table public."pautas" add constraint "pautas_board_id_fkey" FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE RESTRICT;

alter table public."pautas" add constraint "pautas_dates_chk" CHECK ((magic_number_date <= scheduled_until_date));

alter table public."pautas" add constraint "pautas_lifecycle_status_chk" CHECK ((lifecycle_status = ANY (ARRAY['draft'::text, 'open'::text, 'closed'::text, 'archived'::text])));

alter table public."pautas" add constraint "pautas_pkey" PRIMARY KEY (id);

alter table public."pautas" add constraint "pautas_reference_month_chk" CHECK ((reference_month = (date_trunc('month'::text, (reference_month)::timestamp with time zone))::date));

alter table public."pautas" add constraint "pautas_scheduled_until_reference_month_chk" CHECK ((scheduled_until_date >= reference_month));

alter table public."pautas" enable row level security;

CREATE UNIQUE INDEX pautas_pkey ON public.pautas USING btree (id);

CREATE UNIQUE INDEX pautas_board_reference_month_uidx ON public.pautas USING btree (board_id, reference_month);

CREATE INDEX pautas_magic_number_idx ON public.pautas USING btree (magic_number_date) WHERE (archived_at IS NULL);

CREATE INDEX pautas_scheduled_until_idx ON public.pautas USING btree (scheduled_until_date) WHERE (archived_at IS NULL);

CREATE INDEX pautas_lifecycle_status_idx ON public.pautas USING btree (lifecycle_status);

alter table public."profiles" add constraint "profiles_email_key" UNIQUE (email);

alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);

alter table public."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'director'::text, 'manager'::text, 'team_lead'::text, 'collaborator'::text, 'freelancer'::text, 'traffic'::text, 'financial'::text])));

alter table public."profiles" enable row level security;

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email);

CREATE INDEX idx_profiles_active ON public.profiles USING btree (is_active);

alter table public."project_step_statuses" add constraint "project_step_statuses_behavior_check" CHECK ((behavior = ANY (ARRAY['pending'::text, 'active'::text, 'blocked'::text, 'done'::text])));

alter table public."project_step_statuses" add constraint "project_step_statuses_color_check" CHECK ((color ~ '^#[0-9A-Fa-f]{6}$'::text));

alter table public."project_step_statuses" add constraint "project_step_statuses_name_check" CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 48)));

alter table public."project_step_statuses" add constraint "project_step_statuses_pkey" PRIMARY KEY (id);

alter table public."project_step_statuses" add constraint "project_step_statuses_work_item_id_fkey" FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE;

alter table public."project_step_statuses" enable row level security;

CREATE UNIQUE INDEX project_step_statuses_pkey ON public.project_step_statuses USING btree (id);

CREATE UNIQUE INDEX project_step_statuses_name_unique ON public.project_step_statuses USING btree (work_item_id, lower(TRIM(BOTH FROM name))) WHERE (is_archived = false);

CREATE INDEX idx_project_step_statuses_project_position ON public.project_step_statuses USING btree (work_item_id, "position");

alter table public."project_steps" add constraint "project_steps_pkey" PRIMARY KEY (id);

alter table public."project_steps" add constraint "project_steps_responsible_id_fkey" FOREIGN KEY (responsible_id) REFERENCES profiles(id);

alter table public."project_steps" add constraint "project_steps_status_check" CHECK ((status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'waiting'::text, 'blocked'::text, 'done'::text])));

alter table public."project_steps" add constraint "project_steps_status_id_fkey" FOREIGN KEY (status_id) REFERENCES project_step_statuses(id) ON DELETE SET NULL;

alter table public."project_steps" add constraint "project_steps_work_item_id_fkey" FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE;

alter table public."project_steps" enable row level security;

CREATE UNIQUE INDEX project_steps_pkey ON public.project_steps USING btree (id);

CREATE INDEX idx_project_steps_work_item ON public.project_steps USING btree (work_item_id);

CREATE INDEX idx_project_steps_end_date ON public.project_steps USING btree (end_date);

CREATE INDEX idx_project_steps_status_id ON public.project_steps USING btree (status_id);

alter table public."projects" add constraint "projects_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id);

alter table public."projects" add constraint "projects_pkey" PRIMARY KEY (id);

alter table public."projects" add constraint "projects_responsible_id_fkey" FOREIGN KEY (responsible_id) REFERENCES profiles(id);

alter table public."projects" add constraint "projects_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'at_risk'::text, 'done'::text, 'cancelled'::text])));

alter table public."projects" add constraint "projects_type_check" CHECK ((type = ANY (ARRAY['recurring'::text, 'project'::text, 'campaign'::text, 'internal'::text, 'traffic'::text])));

alter table public."projects" enable row level security;

CREATE UNIQUE INDEX projects_pkey ON public.projects USING btree (id);

alter table public."resource_links" add constraint "resource_links_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);

alter table public."resource_links" add constraint "resource_links_pkey" PRIMARY KEY (id);

alter table public."resource_links" enable row level security;

CREATE UNIQUE INDEX resource_links_pkey ON public.resource_links USING btree (id);

alter table public."service_catalog" add constraint "service_catalog_pkey" PRIMARY KEY (id);

alter table public."service_catalog" enable row level security;

CREATE UNIQUE INDEX service_catalog_pkey ON public.service_catalog USING btree (id);

alter table public."team_access_audit" add constraint "team_access_audit_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."team_access_audit" add constraint "team_access_audit_pkey" PRIMARY KEY (id);

alter table public."team_access_audit" add constraint "team_access_audit_target_profile_id_fkey" FOREIGN KEY (target_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."team_access_audit" enable row level security;

CREATE UNIQUE INDEX team_access_audit_pkey ON public.team_access_audit USING btree (id);

alter table public."team_members" add constraint "team_members_access_type_check" CHECK ((access_type = ANY (ARRAY['total'::text, 'operacional'::text])));

alter table public."team_members" add constraint "team_members_last_access_changed_by_fkey" FOREIGN KEY (last_access_changed_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."team_members" add constraint "team_members_pkey" PRIMARY KEY (id);

alter table public."team_members" add constraint "team_members_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."team_members" enable row level security;

CREATE UNIQUE INDEX team_members_pkey ON public.team_members USING btree (id);

CREATE UNIQUE INDEX team_members_email_lower_unique ON public.team_members USING btree (lower(email));

CREATE INDEX idx_team_members_profile_id ON public.team_members USING btree (profile_id);

CREATE INDEX idx_team_members_area ON public.team_members USING btree (operational_area);

CREATE INDEX idx_team_members_access_type ON public.team_members USING btree (access_type);

CREATE INDEX idx_team_members_active ON public.team_members USING btree (is_active);

CREATE UNIQUE INDEX team_members_email_unique_lower ON public.team_members USING btree (lower(email));

CREATE UNIQUE INDEX team_members_profile_unique ON public.team_members USING btree (profile_id) WHERE (profile_id IS NOT NULL);

alter table public."trafego_acoes" add constraint "trafego_acoes_desfaz_acao_id_fkey" FOREIGN KEY (desfaz_acao_id) REFERENCES trafego_acoes(id);

alter table public."trafego_acoes" add constraint "trafego_acoes_execucao_id_fkey" FOREIGN KEY (execucao_id) REFERENCES trafego_execucoes(id) ON DELETE SET NULL;

alter table public."trafego_acoes" add constraint "trafego_acoes_nivel_check" CHECK ((nivel = ANY (ARRAY['campaign'::text, 'adset'::text, 'ad'::text])));

alter table public."trafego_acoes" add constraint "trafego_acoes_pkey" PRIMARY KEY (id);

alter table public."trafego_acoes" add constraint "trafego_acoes_status_check" CHECK ((status = ANY (ARRAY['simulado'::text, 'executado'::text, 'erro'::text, 'desfeito'::text, 'bloqueado'::text])));

alter table public."trafego_acoes" add constraint "trafego_acoes_tipo_check" CHECK ((tipo = ANY (ARRAY['pausar'::text, 'reduzir_orcamento'::text, 'aumentar_orcamento'::text, 'reativar'::text, 'ajustar_orcamento'::text])));

alter table public."trafego_acoes" enable row level security;

CREATE UNIQUE INDEX trafego_acoes_pkey ON public.trafego_acoes USING btree (id);

CREATE INDEX trafego_acoes_objeto_idx ON public.trafego_acoes USING btree (objeto_id, created_at DESC);

CREATE INDEX trafego_acoes_conta_idx ON public.trafego_acoes USING btree (meta_account_id, created_at DESC);

alter table public."trafego_alertas" add constraint "trafego_alertas_chave_dia_key" UNIQUE (chave, dia);

alter table public."trafego_alertas" add constraint "trafego_alertas_execucao_id_fkey" FOREIGN KEY (execucao_id) REFERENCES trafego_execucoes(id) ON DELETE SET NULL;

alter table public."trafego_alertas" add constraint "trafego_alertas_pkey" PRIMARY KEY (id);

alter table public."trafego_alertas" add constraint "trafego_alertas_severidade_check" CHECK ((severidade = ANY (ARRAY['critico'::text, 'atencao'::text, 'info'::text])));

alter table public."trafego_alertas" enable row level security;

CREATE UNIQUE INDEX trafego_alertas_pkey ON public.trafego_alertas USING btree (id);

CREATE UNIQUE INDEX trafego_alertas_chave_dia_key ON public.trafego_alertas USING btree (chave, dia);

alter table public."trafego_config" add constraint "trafego_config_pkey" PRIMARY KEY (key);

alter table public."trafego_config" enable row level security;

CREATE UNIQUE INDEX trafego_config_pkey ON public.trafego_config USING btree (key);

alter table public."trafego_contas" add constraint "trafego_contas_meta_account_id_fkey" FOREIGN KEY (meta_account_id) REFERENCES meta_ad_accounts(meta_account_id) ON DELETE CASCADE;

alter table public."trafego_contas" add constraint "trafego_contas_modo_check" CHECK ((modo = ANY (ARRAY['executar'::text, 'observar'::text, 'desligado'::text])));

alter table public."trafego_contas" add constraint "trafego_contas_pkey" PRIMARY KEY (meta_account_id);

alter table public."trafego_contas" enable row level security;

CREATE UNIQUE INDEX trafego_contas_pkey ON public.trafego_contas USING btree (meta_account_id);

alter table public."trafego_execucoes" add constraint "trafego_execucoes_pkey" PRIMARY KEY (id);

alter table public."trafego_execucoes" enable row level security;

CREATE UNIQUE INDEX trafego_execucoes_pkey ON public.trafego_execucoes USING btree (id);

alter table public."trafego_metas" add constraint "trafego_metas_meta_account_id_fkey" FOREIGN KEY (meta_account_id) REFERENCES meta_ad_accounts(meta_account_id) ON DELETE CASCADE;

alter table public."trafego_metas" add constraint "trafego_metas_meta_account_id_result_indicator_key" UNIQUE (meta_account_id, result_indicator);

alter table public."trafego_metas" add constraint "trafego_metas_pkey" PRIMARY KEY (id);

alter table public."trafego_metas" enable row level security;

CREATE UNIQUE INDEX trafego_metas_pkey ON public.trafego_metas USING btree (id);

CREATE UNIQUE INDEX trafego_metas_meta_account_id_result_indicator_key ON public.trafego_metas USING btree (meta_account_id, result_indicator);

alter table public."traffic_report_clients" add constraint "traffic_report_clients_ad_account_id_fkey" FOREIGN KEY (ad_account_id) REFERENCES meta_ad_accounts(id) ON DELETE CASCADE;

alter table public."traffic_report_clients" add constraint "traffic_report_clients_ad_account_id_key" UNIQUE (ad_account_id);

alter table public."traffic_report_clients" add constraint "traffic_report_clients_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

alter table public."traffic_report_clients" add constraint "traffic_report_clients_pkey" PRIMARY KEY (id);

alter table public."traffic_report_clients" enable row level security;

CREATE UNIQUE INDEX traffic_report_clients_pkey ON public.traffic_report_clients USING btree (id);

CREATE UNIQUE INDEX traffic_report_clients_ad_account_id_key ON public.traffic_report_clients USING btree (ad_account_id);

alter table public."traffic_report_deliveries" add constraint "traffic_report_deliveries_ad_account_id_fkey" FOREIGN KEY (ad_account_id) REFERENCES meta_ad_accounts(id) ON DELETE SET NULL;

alter table public."traffic_report_deliveries" add constraint "traffic_report_deliveries_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

alter table public."traffic_report_deliveries" add constraint "traffic_report_deliveries_mode_check" CHECK ((mode = ANY (ARRAY['revisao'::text, 'cliente'::text])));

alter table public."traffic_report_deliveries" add constraint "traffic_report_deliveries_pkey" PRIMARY KEY (id);

alter table public."traffic_report_deliveries" add constraint "traffic_report_deliveries_report_client_id_fkey" FOREIGN KEY (report_client_id) REFERENCES traffic_report_clients(id) ON DELETE SET NULL;

alter table public."traffic_report_deliveries" add constraint "traffic_report_deliveries_status_check" CHECK ((status = ANY (ARRAY['gerado'::text, 'enviado'::text, 'falhou'::text, 'pulado'::text])));

alter table public."traffic_report_deliveries" enable row level security;

CREATE UNIQUE INDEX traffic_report_deliveries_pkey ON public.traffic_report_deliveries USING btree (id);

CREATE INDEX traffic_report_deliveries_period_idx ON public.traffic_report_deliveries USING btree (period_since, period_until);

alter table public."traffic_report_settings" add constraint "traffic_report_settings_pkey" PRIMARY KEY (key);

alter table public."traffic_report_settings" enable row level security;

CREATE UNIQUE INDEX traffic_report_settings_pkey ON public.traffic_report_settings USING btree (key);

alter table public."work_item_board_assignment_events" add constraint "work_item_board_assignment_events_action_chk" CHECK (((char_length(TRIM(BOTH FROM action)) >= 2) AND (char_length(TRIM(BOTH FROM action)) <= 80)));

alter table public."work_item_board_assignment_events" add constraint "work_item_board_assignment_events_actor_fk" FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."work_item_board_assignment_events" add constraint "work_item_board_assignment_events_assignment_fk" FOREIGN KEY (assignment_id) REFERENCES work_item_board_assignments(id) ON DELETE SET NULL;

alter table public."work_item_board_assignment_events" add constraint "work_item_board_assignment_events_board_fk" FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL;

alter table public."work_item_board_assignment_events" add constraint "work_item_board_assignment_events_column_fk" FOREIGN KEY (board_column_id) REFERENCES board_columns(id) ON DELETE SET NULL;

alter table public."work_item_board_assignment_events" add constraint "work_item_board_assignment_events_pauta_fk" FOREIGN KEY (pauta_id) REFERENCES pautas(id) ON DELETE SET NULL;

alter table public."work_item_board_assignment_events" add constraint "work_item_board_assignment_events_pkey" PRIMARY KEY (id);

alter table public."work_item_board_assignment_events" add constraint "work_item_board_assignment_events_work_item_fk" FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE;

alter table public."work_item_board_assignment_events" enable row level security;

CREATE UNIQUE INDEX work_item_board_assignment_events_pkey ON public.work_item_board_assignment_events USING btree (id);

CREATE INDEX work_item_board_assignment_events_item_created_idx ON public.work_item_board_assignment_events USING btree (work_item_id, created_at DESC);

CREATE INDEX work_item_board_assignment_events_assignment_created_idx ON public.work_item_board_assignment_events USING btree (assignment_id, created_at DESC);

CREATE INDEX work_item_board_assignment_events_pauta_created_idx ON public.work_item_board_assignment_events USING btree (pauta_id, created_at DESC);

alter table public."work_item_board_assignments" add constraint "work_item_board_assignments_assigned_by_fk" FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."work_item_board_assignments" add constraint "work_item_board_assignments_assignment_status_chk" CHECK ((assignment_status = ANY (ARRAY['active'::text, 'removed'::text])));

alter table public."work_item_board_assignments" add constraint "work_item_board_assignments_board_fk" FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE RESTRICT;

alter table public."work_item_board_assignments" add constraint "work_item_board_assignments_column_fk" FOREIGN KEY (board_id, board_column_id) REFERENCES board_columns(board_id, id) ON DELETE RESTRICT;

alter table public."work_item_board_assignments" add constraint "work_item_board_assignments_completed_by_fk" FOREIGN KEY (completed_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."work_item_board_assignments" add constraint "work_item_board_assignments_completed_state_chk" CHECK ((((operational_status = ANY (ARRAY['done'::text, 'delivered'::text, 'approved'::text])) AND (completed_at IS NOT NULL)) OR (operational_status <> ALL (ARRAY['done'::text, 'delivered'::text, 'approved'::text]))));

alter table public."work_item_board_assignments" add constraint "work_item_board_assignments_pkey" PRIMARY KEY (id);

alter table public."work_item_board_assignments" add constraint "work_item_board_assignments_removed_by_fk" FOREIGN KEY (removed_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."work_item_board_assignments" add constraint "work_item_board_assignments_removed_state_chk" CHECK ((((assignment_status = 'active'::text) AND (removed_at IS NULL)) OR ((assignment_status = 'removed'::text) AND (removed_at IS NOT NULL))));

alter table public."work_item_board_assignments" add constraint "work_item_board_assignments_status_chk" CHECK ((operational_status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'waiting'::text, 'blocked'::text, 'in_review'::text, 'awaiting_approval'::text, 'approved'::text, 'scheduled'::text, 'delivered'::text, 'done'::text, 'cancelled'::text, 'archived'::text])));

alter table public."work_item_board_assignments" add constraint "work_item_board_assignments_work_item_fk" FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE;

alter table public."work_item_board_assignments" enable row level security;

CREATE UNIQUE INDEX work_item_board_assignments_pkey ON public.work_item_board_assignments USING btree (id);

CREATE UNIQUE INDEX work_item_board_assignments_active_uidx ON public.work_item_board_assignments USING btree (work_item_id, board_id) WHERE (assignment_status = 'active'::text);

CREATE INDEX work_item_board_assignments_board_column_idx ON public.work_item_board_assignments USING btree (board_id, board_column_id, assignment_status, "position");

CREATE INDEX work_item_board_assignments_work_item_idx ON public.work_item_board_assignments USING btree (work_item_id, assignment_status);

CREATE INDEX work_item_board_assignments_status_idx ON public.work_item_board_assignments USING btree (operational_status, assignment_status);

alter table public."work_item_checklists" add constraint "work_item_checklists_done_by_fkey" FOREIGN KEY (done_by) REFERENCES profiles(id);

alter table public."work_item_checklists" add constraint "work_item_checklists_pkey" PRIMARY KEY (id);

alter table public."work_item_checklists" add constraint "work_item_checklists_work_item_id_fkey" FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE;

alter table public."work_item_checklists" enable row level security;

CREATE UNIQUE INDEX work_item_checklists_pkey ON public.work_item_checklists USING btree (id);

alter table public."work_item_comments" add constraint "work_item_comments_author_id_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id);

alter table public."work_item_comments" add constraint "work_item_comments_pkey" PRIMARY KEY (id);

alter table public."work_item_comments" add constraint "work_item_comments_work_item_id_fkey" FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE;

alter table public."work_item_comments" enable row level security;

CREATE UNIQUE INDEX work_item_comments_pkey ON public.work_item_comments USING btree (id);

alter table public."work_item_history" add constraint "work_item_history_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES profiles(id);

alter table public."work_item_history" add constraint "work_item_history_pkey" PRIMARY KEY (id);

alter table public."work_item_history" add constraint "work_item_history_work_item_id_fkey" FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE;

alter table public."work_item_history" enable row level security;

CREATE UNIQUE INDEX work_item_history_pkey ON public.work_item_history USING btree (id);

CREATE INDEX idx_work_item_history_work_item ON public.work_item_history USING btree (work_item_id);

CREATE INDEX idx_work_item_history_actor ON public.work_item_history USING btree (actor_id);

alter table public."work_item_schedule_requirements" add constraint "work_item_schedule_requirements_calendar_event_id_fkey" FOREIGN KEY (calendar_event_id) REFERENCES calendar_events(id) ON DELETE SET NULL;

alter table public."work_item_schedule_requirements" add constraint "work_item_schedule_requirements_calendar_type_check" CHECK (((calendar_type IS NULL) OR (calendar_type = ANY (ARRAY['reu_a'::text, 'cap_e'::text, 'cap_s'::text]))));

alter table public."work_item_schedule_requirements" add constraint "work_item_schedule_requirements_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."work_item_schedule_requirements" add constraint "work_item_schedule_requirements_item_type_unique" UNIQUE (work_item_id, requirement_type);

alter table public."work_item_schedule_requirements" add constraint "work_item_schedule_requirements_pkey" PRIMARY KEY (id);

alter table public."work_item_schedule_requirements" add constraint "work_item_schedule_requirements_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text])));

alter table public."work_item_schedule_requirements" add constraint "work_item_schedule_requirements_type_check" CHECK ((requirement_type = ANY (ARRAY['alignment_meeting'::text, 'capture'::text])));

alter table public."work_item_schedule_requirements" add constraint "work_item_schedule_requirements_work_item_id_fkey" FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE;

alter table public."work_item_schedule_requirements" enable row level security;

CREATE UNIQUE INDEX work_item_schedule_requirements_pkey ON public.work_item_schedule_requirements USING btree (id);

CREATE UNIQUE INDEX work_item_schedule_requirements_item_type_unique ON public.work_item_schedule_requirements USING btree (work_item_id, requirement_type);

CREATE UNIQUE INDEX work_item_schedule_requirements_event_unique ON public.work_item_schedule_requirements USING btree (calendar_event_id) WHERE (calendar_event_id IS NOT NULL);

CREATE INDEX idx_work_item_schedule_requirements_item ON public.work_item_schedule_requirements USING btree (work_item_id);

CREATE INDEX idx_work_item_schedule_requirements_status ON public.work_item_schedule_requirements USING btree (status);

alter table public."work_items" add constraint "work_items_board_column_id_fkey" FOREIGN KEY (board_column_id) REFERENCES board_columns(id) ON DELETE SET NULL;

alter table public."work_items" add constraint "work_items_board_id_fkey" FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL;

alter table public."work_items" add constraint "work_items_card_tag_color_check" CHECK ((card_tag_color = ANY (ARRAY['slate'::text, 'blue'::text, 'purple'::text, 'yellow'::text, 'red'::text, 'green'::text])));

alter table public."work_items" add constraint "work_items_card_tag_length_check" CHECK (((card_tag IS NULL) OR (((char_length(btrim(card_tag)) >= 1) AND (char_length(btrim(card_tag)) <= 16)) AND (card_tag = upper(card_tag)))));

alter table public."work_items" add constraint "work_items_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id);

alter table public."work_items" add constraint "work_items_client_service_id_fkey" FOREIGN KEY (client_service_id) REFERENCES client_services(id);

alter table public."work_items" add constraint "work_items_completion_delay_days_chk" CHECK (((completion_delay_days IS NULL) OR (completion_delay_days >= 0)));

alter table public."work_items" add constraint "work_items_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);

alter table public."work_items" add constraint "work_items_cycle_duration_snapshot_check" CHECK (((cycle_duration_days_snapshot IS NULL) OR ((cycle_duration_days_snapshot >= 1) AND (cycle_duration_days_snapshot <= 365))));

alter table public."work_items" add constraint "work_items_cycle_number_check" CHECK (((cycle_number IS NULL) OR (cycle_number >= 1)));

alter table public."work_items" add constraint "work_items_destino_check" CHECK ((destino = ANY (ARRAY['quadro'::text, 'projeto'::text, 'ambos'::text, 'avulsa'::text])));

alter table public."work_items" add constraint "work_items_done_requires_completed_at" CHECK (((status <> 'done'::text) OR (completed_at IS NOT NULL)));

alter table public."work_items" add constraint "work_items_generated_by_fkey" FOREIGN KEY (generated_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."work_items" add constraint "work_items_generated_from_cycle_id_fkey" FOREIGN KEY (generated_from_cycle_id) REFERENCES work_items(id) ON DELETE SET NULL;

alter table public."work_items" add constraint "work_items_origin_check" CHECK ((origin = ANY (ARRAY['planned'::text, 'recurring'::text, 'extra'::text, 'adjustment'::text, 'urgent'::text, 'internal'::text])));

alter table public."work_items" add constraint "work_items_pauta_card_id_fkey" FOREIGN KEY (pauta_card_id) REFERENCES work_items(id) ON DELETE SET NULL;

alter table public."work_items" add constraint "work_items_pauta_card_not_self_chk" CHECK (((pauta_card_id IS NULL) OR (pauta_card_id <> id)));

alter table public."work_items" add constraint "work_items_pauta_card_requires_context_chk" CHECK (((is_pauta_card = false) OR ((pauta_id IS NOT NULL) AND (client_id IS NOT NULL))));

alter table public."work_items" add constraint "work_items_pauta_id_fkey" FOREIGN KEY (pauta_id) REFERENCES pautas(id) ON DELETE SET NULL;

alter table public."work_items" add constraint "work_items_pkey" PRIMARY KEY (id);

alter table public."work_items" add constraint "work_items_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])));

alter table public."work_items" add constraint "work_items_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id);

alter table public."work_items" add constraint "work_items_responsible_id_fkey" FOREIGN KEY (responsible_id) REFERENCES profiles(id);

alter table public."work_items" add constraint "work_items_status_check" CHECK ((status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'waiting'::text, 'blocked'::text, 'in_review'::text, 'awaiting_approval'::text, 'approved'::text, 'scheduled'::text, 'delivered'::text, 'done'::text, 'cancelled'::text, 'archived'::text])));

alter table public."work_items" enable row level security;

CREATE UNIQUE INDEX work_items_pkey ON public.work_items USING btree (id);

CREATE INDEX idx_work_items_client ON public.work_items USING btree (client_id);

CREATE INDEX idx_work_items_responsible ON public.work_items USING btree (responsible_id);

CREATE INDEX idx_work_items_status ON public.work_items USING btree (status);

CREATE INDEX idx_work_items_final_deadline ON public.work_items USING btree (final_deadline);

CREATE INDEX idx_work_items_priority ON public.work_items USING btree (priority);

CREATE INDEX idx_work_items_destino ON public.work_items USING btree (destino);

CREATE INDEX idx_work_items_client_service ON public.work_items USING btree (client_service_id);

CREATE INDEX idx_work_items_board_id ON public.work_items USING btree (board_id);

CREATE INDEX idx_work_items_board_column_id ON public.work_items USING btree (board_column_id);

CREATE UNIQUE INDEX work_items_generated_from_cycle_unique ON public.work_items USING btree (generated_from_cycle_id) WHERE (generated_from_cycle_id IS NOT NULL);

CREATE INDEX idx_work_items_cycle_number ON public.work_items USING btree (client_id, cycle_number);

CREATE INDEX idx_work_items_generated_by ON public.work_items USING btree (generated_by);

CREATE UNIQUE INDEX work_items_pauta_client_card_uidx ON public.work_items USING btree (pauta_id, client_id) WHERE (is_pauta_card = true);

CREATE INDEX work_items_pauta_id_idx ON public.work_items USING btree (pauta_id);

CREATE INDEX work_items_pauta_card_id_idx ON public.work_items USING btree (pauta_card_id);

CREATE INDEX work_items_pauta_progress_idx ON public.work_items USING btree (pauta_id, is_pauta_card, board_column_id, completed_at);

CREATE OR REPLACE FUNCTION public.meta_result_label(p_indicator text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_indicator is null then null
    when p_indicator like '%messaging_conversation_started%' then 'Conversas iniciadas'
    when p_indicator in ('profile_visit_view', 'total_profile_visits') then 'Visitas ao perfil'
    when p_indicator = 'lead' or p_indicator like '%fb_pixel_lead%' or p_indicator like '%lead_grouped%' or p_indicator = 'actions:lead' then 'Leads'
    when p_indicator like '%fb_pixel_purchase%' or p_indicator in ('actions:omni_purchase', 'actions:purchase') then 'Compras'
    when p_indicator like '%initiate_checkout%' then 'Finalizações de compra iniciadas'
    when p_indicator like '%add_to_cart%' then 'Adições ao carrinho'
    when p_indicator like '%complete_registration%' then 'Cadastros'
    when p_indicator = 'actions:link_click' then 'Cliques no link'
    when p_indicator like '%landing_page_view%' then 'Visualizações da página de destino'
    when p_indicator = 'reach' then 'Alcance'
    when p_indicator like '%video_view%' or p_indicator like '%thruplay%' then 'Visualizações de vídeo'
    when p_indicator like '%post_engagement%' then 'Engajamentos'
    else p_indicator
  end
$function$
;

CREATE OR REPLACE FUNCTION public.n8n_traffic_secret()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select decrypted_secret from vault.decrypted_secrets where name = 'n8n_traffic_secret' limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.traffic_weekly_report(p_since date, p_until date, p_account_ids text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with p as (
  select p_since as s, p_until as u, p_since - (p_until - p_since + 1) as ps, p_since - 1 as pu
),
accs as (
  select a.id, a.meta_account_id, a.name, a.last_synced_at
  from public.meta_ad_accounts a
  where a.is_selected and (p_account_ids is null or a.meta_account_id = any(p_account_ids))
),
acc_m as (
  select i.ad_account_id,
    coalesce(sum(i.spend) filter (where i.date_start between p.s and p.u), 0) as spend,
    coalesce(sum(i.spend) filter (where i.date_start between p.ps and p.pu), 0) as spend_prev,
    coalesce(sum(i.impressions) filter (where i.date_start between p.s and p.u), 0) as impressions,
    coalesce(sum(i.inline_link_clicks) filter (where i.date_start between p.s and p.u), 0) as link_clicks
  from public.meta_insights_daily i cross join p
  where i.level = 'account' and i.date_start between p.ps and p.u
    and i.ad_account_id in (select id from accs)
  group by i.ad_account_id
),
ad_rows as (
  select i.ad_account_id, i.entity_id, i.meta_campaign_id, i.objective, i.spend,
    i.result_indicator, i.result_count, i.actions,
    (i.date_start between p.s and p.u) as cur
  from public.meta_insights_daily i cross join p
  where i.level = 'adset' and i.date_start between p.ps and p.u
    and i.ad_account_id in (select id from accs)
),
adset_ind as (
  select entity_id,
    coalesce(
      mode() within group (order by result_indicator) filter (where result_indicator is not null and result_indicator <> 'mixed'),
      case when bool_or(objective = 'OUTCOME_LEADS') then 'lead' end
    ) as ind
  from ad_rows
  group by entity_id
),
res_raw as (
  select r.ad_account_id, r.meta_campaign_id, r.cur, r.spend, ai.ind,
    case
      when ai.ind = 'lead' and (r.result_indicator is null or r.result_indicator = 'mixed')
        then coalesce((select sum((x->>'value')::numeric)
                       from jsonb_array_elements(coalesce(r.actions, '[]'::jsonb)) x
                       where x->>'action_type' = 'lead'), 0)
      else coalesce(r.result_count, 0)
    end as cnt
  from ad_rows r
  join adset_ind ai on ai.entity_id = r.entity_id
  where ai.ind is not null
),
acc_res as (
  select ad_account_id, public.meta_result_label(ind) as label,
    sum(cnt) filter (where cur) as cnt,
    sum(cnt) filter (where not cur) as cnt_prev,
    sum(spend) filter (where cur) as spend,
    sum(spend) filter (where not cur) as spend_prev
  from res_raw
  group by 1, 2
),
camp_res as (
  select ad_account_id, meta_campaign_id, public.meta_result_label(ind) as label,
    sum(cnt) as cnt, sum(spend) as spend
  from res_raw
  where cur
  group by 1, 2, 3
  having sum(spend) > 0 or sum(cnt) > 0
),
camp_m as (
  select i.ad_account_id, i.entity_id as meta_campaign_id, max(i.entity_name) as name,
    sum(i.spend) as spend, sum(i.impressions) as impressions, sum(i.inline_link_clicks) as link_clicks
  from public.meta_insights_daily i cross join p
  where i.level = 'campaign' and i.date_start between p.s and p.u
    and i.ad_account_id in (select id from accs)
  group by 1, 2
  having sum(i.spend) > 0
),
camp_obj as (
  select c.ad_account_id, c.spend, jsonb_build_object(
    'name', coalesce(mc.name, c.name),
    'status', mc.effective_status,
    'objective', mc.objective,
    'daily_budget', coalesce(nullif(mc.daily_budget, 0),
        (select nullif(sum(s.daily_budget), 0) from public.meta_adsets s
          where s.meta_campaign_id = c.meta_campaign_id and s.effective_status = 'ACTIVE')),
    'spend', round(c.spend, 2),
    'impressions', c.impressions,
    'cpm', case when c.impressions > 0 then round(c.spend / c.impressions * 1000, 2) end,
    'ctr', case when c.impressions > 0 then round(c.link_clicks::numeric / c.impressions * 100, 2) end,
    'results', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'label', cr.label,
                 'count', cr.cnt,
                 'cost', case when cr.cnt > 0 then round(cr.spend / cr.cnt, 2) end)
               order by cr.spend desc)
        from camp_res cr
        where cr.ad_account_id = c.ad_account_id and cr.meta_campaign_id = c.meta_campaign_id), '[]'::jsonb)
  ) as obj
  from camp_m c
  left join public.meta_campaigns mc on mc.meta_campaign_id = c.meta_campaign_id
),
acc_obj as (
  select a.id, coalesce(m.spend, 0) as spend, coalesce(m.spend_prev, 0) as spend_prev, jsonb_build_object(
    'meta_account_id', a.meta_account_id,
    'name', a.name,
    'last_synced_at', a.last_synced_at,
    'spend', round(coalesce(m.spend, 0), 2),
    'spend_prev', round(coalesce(m.spend_prev, 0), 2),
    'impressions', coalesce(m.impressions, 0),
    'cpm', case when m.impressions > 0 then round(m.spend / m.impressions * 1000, 2) end,
    'ctr', case when m.impressions > 0 then round(m.link_clicks::numeric / m.impressions * 100, 2) end,
    'results', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'label', r.label,
                 'count', coalesce(r.cnt, 0),
                 'count_prev', coalesce(r.cnt_prev, 0),
                 'cost', case when r.cnt > 0 then round(r.spend / r.cnt, 2) end,
                 'cost_prev', case when r.cnt_prev > 0 then round(r.spend_prev / r.cnt_prev, 2) end)
               order by r.spend desc nulls last)
        from acc_res r
        where r.ad_account_id = a.id
          and (coalesce(r.cnt, 0) > 0 or coalesce(r.cnt_prev, 0) > 0 or coalesce(r.spend, 0) > 0)), '[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(co.obj order by co.spend desc) from camp_obj co where co.ad_account_id = a.id), '[]'::jsonb)
  ) as obj
  from accs a
  left join acc_m m on m.ad_account_id = a.id
)
select jsonb_build_object(
  'period', jsonb_build_object('since', p.s, 'until', p.u),
  'previous', jsonb_build_object('since', p.ps, 'until', p.pu),
  'totals', jsonb_build_object(
    'spend', (select round(coalesce(sum(spend), 0), 2) from acc_obj),
    'spend_prev', (select round(coalesce(sum(spend_prev), 0), 2) from acc_obj),
    'accounts_with_spend', (select count(*) from acc_obj where spend > 0),
    'accounts_selected', (select count(*) from acc_obj)),
  'accounts', coalesce((select jsonb_agg(obj order by spend desc) from acc_obj where spend > 0), '[]'::jsonb),
  'no_spend', coalesce((select jsonb_agg(jsonb_build_object('name', obj->>'name', 'meta_account_id', obj->>'meta_account_id', 'spend_prev', round(spend_prev, 2)) order by spend_prev desc, obj->>'name')
                        from acc_obj where spend = 0), '[]'::jsonb)
)
from p;
$function$
;

CREATE OR REPLACE FUNCTION public.meta_action_sum(p_actions jsonb, p_types text[])
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(sum((x->>'value')::numeric), 0)
  from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb)) x
  where x->>'action_type' = any(p_types)
$function$
;

CREATE OR REPLACE FUNCTION public.traffic_prev_period(p_since date, p_until date, OUT prev_since date, OUT prev_until date)
 RETURNS record
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select
    case
      -- mês inteiro: compara com o mês anterior inteiro
      when extract(day from p_since) = 1 and p_until = (date_trunc('month', p_since) + interval '1 month - 1 day')::date
        then (p_since - interval '1 month')::date
      -- 1 a 15: compara com 16 ao último dia do mês anterior
      when extract(day from p_since) = 1 and p_until = p_since + 14
        then (p_since - interval '1 month' + interval '15 days')::date
      -- 16 ao último dia: compara com 1 a 15 do mesmo mês
      when extract(day from p_since) = 16 and p_until = (date_trunc('month', p_since) + interval '1 month - 1 day')::date
        then p_since - 15
      -- qualquer outro período: mesmo tamanho, logo antes
      else p_since - (p_until - p_since + 1)
    end,
    p_since - 1
$function$
;

CREATE OR REPLACE FUNCTION public.traffic_client_report(p_report_client_id uuid, p_since date, p_until date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with rc as (
  select r.*, a.meta_account_id, a.name as account_name, a.last_synced_at,
         c.name as client_name, c.main_contact_name, c.main_contact_email
  from public.traffic_report_clients r
  join public.meta_ad_accounts a on a.id = r.ad_account_id
  left join public.clients c on c.id = r.client_id
  where r.id = p_report_client_id
),
p as (
  select p_since as s, p_until as u, pp.prev_since as ps, pp.prev_until as pu
  from public.traffic_prev_period(p_since, p_until) pp
),
tot as (
  select i.since,
    jsonb_build_object(
      'spend', round(i.spend, 2), 'impressions', i.impressions, 'reach', i.reach, 'frequency', round(i.frequency, 2),
      'clicks', i.clicks, 'link_clicks', i.inline_link_clicks,
      'ctr_link', case when i.impressions > 0 then round(i.inline_link_clicks::numeric / i.impressions * 100, 2) end,
      'cpc_link', case when i.inline_link_clicks > 0 then round(i.spend / i.inline_link_clicks, 2) end,
      'cpm', case when i.impressions > 0 then round(i.spend / i.impressions * 1000, 2) end,
      'purchases', public.meta_action_sum(i.actions, array['purchase','omni_purchase','offsite_conversion.fb_pixel_purchase']),
      'purchase_value', public.meta_action_sum(i.action_values, array['purchase','omni_purchase','offsite_conversion.fb_pixel_purchase']),
      'roas', (select round((x->>'value')::numeric, 2) from jsonb_array_elements(coalesce(i.purchase_roas, '[]'::jsonb)) x limit 1),
      'synced_at', i.synced_at
    ) as obj
  from public.meta_period_insights i, rc, p
  where i.ad_account_id = rc.ad_account_id and i.level = 'account'
    and ((i.since = p.s and i.until = p.u) or (i.since = p.ps and i.until = p.pu))
),
ad_rows as (
  select i.entity_id, i.meta_campaign_id, i.objective, i.spend, i.result_indicator, i.result_count, i.actions,
         (i.date_start between p.s and p.u) as cur, i.date_start
  from public.meta_insights_daily i, rc, p
  where i.ad_account_id = rc.ad_account_id and i.level = 'adset' and i.date_start between p.ps and p.u
),
adset_ind as (
  select entity_id,
    coalesce(mode() within group (order by result_indicator) filter (where result_indicator is not null and result_indicator <> 'mixed'),
             case when bool_or(objective = 'OUTCOME_LEADS') then 'lead' end) as ind
  from ad_rows group by entity_id
),
res_raw as (
  select r.meta_campaign_id, r.cur, r.spend, ai.ind,
    case when ai.ind = 'lead' and (r.result_indicator is null or r.result_indicator = 'mixed')
         then public.meta_action_sum(r.actions, array['lead'])
         else coalesce(r.result_count, 0) end as cnt
  from ad_rows r join adset_ind ai on ai.entity_id = r.entity_id
  where ai.ind is not null
),
res as (
  select public.meta_result_label(ind) as label, min(ind) as indicator,
    coalesce(sum(cnt) filter (where cur), 0) as cnt, coalesce(sum(cnt) filter (where not cur), 0) as cnt_prev,
    coalesce(sum(spend) filter (where cur), 0) as spend, coalesce(sum(spend) filter (where not cur), 0) as spend_prev
  from res_raw group by 1
),
camp_res as (
  select meta_campaign_id, public.meta_result_label(ind) as label, sum(cnt) as cnt, sum(spend) as spend
  from res_raw where cur group by 1, 2
),
camps as (
  select i.entity_id, i.entity_name, i.spend, i.impressions, i.reach, i.frequency, i.inline_link_clicks, i.objective,
         mc.effective_status, mc.daily_budget
  from public.meta_period_insights i
  cross join p
  join rc on rc.ad_account_id = i.ad_account_id
  left join public.meta_campaigns mc on mc.meta_campaign_id = i.entity_id
  where i.level = 'campaign' and i.since = p.s and i.until = p.u and i.spend > 0
),
ads as (
  select i.entity_id as ad_id, i.entity_name as ad_name, i.meta_campaign_id, i.spend, i.impressions, i.inline_link_clicks,
    coalesce(nullif(i.result_indicator, 'mixed'), case when i.objective = 'OUTCOME_LEADS' then 'lead' end) as ind,
    case when (i.result_indicator is null or i.result_indicator = 'mixed') and i.objective = 'OUTCOME_LEADS'
         then public.meta_action_sum(i.actions, array['lead']) else coalesce(i.result_count, 0) end as cnt,
    cr.thumbnail_url, cr.image_url, cr.object_type, cr.title, cr.body
  from public.meta_period_insights i
  cross join p
  join rc on rc.ad_account_id = i.ad_account_id
  left join public.meta_ad_creatives cr on cr.meta_ad_id = i.entity_id
  where i.level = 'ad' and i.since = p.s and i.until = p.u and i.spend > 0
)
select jsonb_build_object(
  'client', (select jsonb_build_object(
      'report_client_id', rc.id, 'display_name', rc.display_name, 'client_id', rc.client_id, 'client_name', rc.client_name,
      'contact_name', rc.main_contact_name,
      'recipients', coalesce(to_jsonb(rc.recipients), case when coalesce(rc.main_contact_email, '') <> '' then jsonb_build_array(rc.main_contact_email) else '[]'::jsonb end),
      'cc', coalesce(to_jsonb(rc.cc), '[]'::jsonb),
      'weekly_folder_id', rc.drive_weekly_folder_id, 'client_folder_id', rc.drive_client_folder_id,
      'manager_name', rc.manager_name, 'report_enabled', rc.report_enabled, 'sales_validated', rc.sales_validated,
      'meta_account_id', rc.meta_account_id, 'account_name', rc.account_name, 'last_synced_at', rc.last_synced_at) from rc),
  'period', (select jsonb_build_object('since', s, 'until', u) from p),
  'previous', (select jsonb_build_object('since', ps, 'until', pu) from p),
  'current', (select t.obj from tot t, p where t.since = p.s),
  'previous_totals', (select t.obj from tot t, p where t.since = p.ps),
  'results', coalesce((select jsonb_agg(jsonb_build_object(
      'label', label, 'indicator', indicator, 'count', cnt, 'count_prev', cnt_prev,
      'spend', round(spend, 2), 'spend_prev', round(spend_prev, 2),
      'cost', case when cnt > 0 then round(spend / cnt, 2) end,
      'cost_prev', case when cnt_prev > 0 then round(spend_prev / cnt_prev, 2) end) order by spend desc)
    from res where cnt > 0 or cnt_prev > 0 or spend > 0), '[]'::jsonb),
  'campaigns', coalesce((select jsonb_agg(jsonb_build_object(
      'campaign_id', c.entity_id, 'name', c.entity_name, 'objective', c.objective, 'status', c.effective_status,
      'daily_budget', c.daily_budget, 'spend', round(c.spend, 2), 'impressions', c.impressions, 'reach', c.reach,
      'frequency', round(c.frequency, 2), 'link_clicks', c.inline_link_clicks,
      'ctr_link', case when c.impressions > 0 then round(c.inline_link_clicks::numeric / c.impressions * 100, 2) end,
      'cpm', case when c.impressions > 0 then round(c.spend / c.impressions * 1000, 2) end,
      'results', coalesce((select jsonb_agg(jsonb_build_object('label', cr.label, 'count', cr.cnt,
                    'cost', case when cr.cnt > 0 then round(cr.spend / cr.cnt, 2) end) order by cr.spend desc)
                  from camp_res cr where cr.meta_campaign_id = c.entity_id), '[]'::jsonb)) order by c.spend desc)
    from camps c), '[]'::jsonb),
  'ads', coalesce((select jsonb_agg(jsonb_build_object(
      'ad_id', a.ad_id, 'ad_name', a.ad_name, 'campaign_id', a.meta_campaign_id,
      'spend', round(a.spend, 2), 'impressions', a.impressions, 'link_clicks', a.inline_link_clicks,
      'result_label', public.meta_result_label(a.ind), 'result_count', a.cnt,
      'cost', case when a.cnt > 0 then round(a.spend / a.cnt, 2) end,
      'object_type', a.object_type, 'thumbnail_url', coalesce(a.image_url, a.thumbnail_url)) order by a.cnt desc, a.spend desc)
    from ads a), '[]'::jsonb),
  'data_days', (select jsonb_build_object(
      'current', count(distinct i.date_start) filter (where i.date_start between p.s and p.u),
      'previous', count(distinct i.date_start) filter (where i.date_start between p.ps and p.pu))
    from public.meta_insights_daily i, rc, p
    where i.ad_account_id = rc.ad_account_id and i.level = 'account' and i.date_start between p.ps and p.u)
);
$function$
;

CREATE OR REPLACE FUNCTION public.comercial_rotulo(p timestamp with time zone)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select (array['segunda','terça','quarta','quinta','sexta','sábado','domingo'])[extract(isodow from p at time zone 'America/Sao_Paulo')::int]
    || ', ' || to_char(p at time zone 'America/Sao_Paulo', 'DD/MM')
    || ' às ' || to_char(p at time zone 'America/Sao_Paulo', 'FMHH24')
    || case when extract(minute from p at time zone 'America/Sao_Paulo') = 0 then 'h' else 'h' || to_char(p at time zone 'America/Sao_Paulo', 'MI') end
$function$
;

CREATE OR REPLACE FUNCTION public.comercial_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin new.updated_at := now(); return new; end $function$
;

CREATE OR REPLACE FUNCTION public.comercial_salvar_lead(p_session text, p_dados jsonb)
 RETURNS comercial_leads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l public.comercial_leads;
  s jsonb;
  a jsonb;
  status_antes text;
  novo_status text;
  colab int := case when coalesce(p_dados->>'colaboradores','') ~ '^\d+$' then (p_dados->>'colaboradores')::int end;
begin
  insert into comercial_leads (session_id, canal, origem, telefone, pode_agendar)
  values (p_session,
          coalesce(nullif(p_dados->>'canal',''), 'whatsapp'),
          nullif(p_dados->>'origem',''),
          nullif(p_dados->>'telefone',''),
          true)
  on conflict (session_id) do nothing;

  select status into status_antes from comercial_leads where session_id = p_session;

  update comercial_leads set
    nome = coalesce(nullif(p_dados->>'nome',''), nome),
    empresa = coalesce(nullif(p_dados->>'empresa',''), empresa),
    segmento = coalesce(nullif(p_dados->>'segmento',''), segmento),
    cidade = coalesce(nullif(p_dados->>'cidade',''), cidade),
    colaboradores = coalesce(colab, colaboradores),
    faturamento_faixa = coalesce(nullif(p_dados->>'faturamento_faixa',''), faturamento_faixa),
    investe_marketing = coalesce(nullif(p_dados->>'investe_marketing',''), investe_marketing),
    marketing_hoje = coalesce(nullif(p_dados->>'marketing_hoje',''), marketing_hoje),
    trafego_pago = coalesce(nullif(p_dados->>'trafego_pago',''), trafego_pago),
    investimento_faixa = coalesce(nullif(p_dados->>'investimento_faixa',''), investimento_faixa),
    dor = coalesce(nullif(p_dados->>'dor',''), dor),
    decisor = coalesce(nullif(p_dados->>'decisor',''), decisor),
    urgencia = coalesce(nullif(p_dados->>'urgencia',''), urgencia),
    estagio = coalesce(nullif(p_dados->>'estagio',''), estagio),
    pedido_tipo = coalesce(nullif(p_dados->>'pedido_tipo',''), pedido_tipo),
    email = coalesce(nullif(lower(trim(p_dados->>'email')),''), email),
    telefone = coalesce(nullif(p_dados->>'telefone',''), telefone),
    origem = coalesce(origem, nullif(p_dados->>'origem','')),
    ad_id = coalesce(ad_id, nullif(p_dados->>'ad_id','')),
    ctwa_clid = coalesce(ctwa_clid, nullif(p_dados->>'ctwa_clid','')),
    campanha = coalesce(campanha, nullif(p_dados->>'campanha','')),
    resumo = coalesce(nullif(p_dados->>'resumo',''), resumo),
    updated_at = now()
  where session_id = p_session
  returning * into l;

  s := comercial_pontuar(l);
  a := comercial_avaliar(l);

  novo_status := case
    when l.status in ('agendado','humano','compareceu','nao_compareceu') then l.status
    when a->>'decisao' = 'fora_do_perfil' then 'desqualificado'
    when l.status = 'desqualificado' then 'em_conversa'
    else l.status end;

  a := a || jsonb_build_object('acabou_de_ficar_fora', novo_status = 'desqualificado' and coalesce(status_antes, '') <> 'desqualificado');

  update comercial_leads set
    score = (s->>'score')::int,
    temperatura = s->>'temperatura',
    score_detalhe = s,
    avaliacao = a,
    pode_agendar = (a->>'decisao') not in ('fora_do_perfil', 'morno'),
    motivo_fora = case when a->>'decisao' = 'fora_do_perfil' then a->>'motivo' end,
    status = novo_status
  where id = l.id
  returning * into l;
  return l;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_internal_messages_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.comercial_horarios_livres(p_limite integer DEFAULT 6, p_ocupados jsonb DEFAULT '[]'::jsonb)
 RETURNS TABLE(inicio timestamp with time zone, fim timestamp with time zone, rotulo text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cfg jsonb := (select jsonb_object_agg(key, value) from comercial_config);
  dur int := (cfg->>'duracao_min')::int;
  passo int := (cfg->>'intervalo_slot_min')::int;
  antec int := (cfg->>'antecedencia_min')::int;
  dias int := (cfg->>'dias_busca')::int;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  return query
  with d as (
    select (hoje + g)::date as dia from generate_series(0, dias) g
  ), dd as (
    select d.dia from d where extract(isodow from d.dia)::int in (select jsonb_array_elements_text(cfg->'dias_semana')::int)
  ), j as (
    select dd.dia, (dd.dia + (w->>0)::time) as ini, (dd.dia + (w->>1)::time) as fimj
    from dd cross join jsonb_array_elements(cfg->'janelas') w
  ), s as (
    select (t at time zone 'America/Sao_Paulo') as ini_ts, j.dia,
           case when t::time < '12:00' then 0 else 1 end as turno
    from j cross join lateral generate_series(j.ini, j.fimj - make_interval(mins => dur), make_interval(mins => passo)) t
  ), google as (
    select (o->>'inicio')::timestamptz as gi, (o->>'fim')::timestamptz as gf
    from jsonb_array_elements(coalesce(p_ocupados, '[]'::jsonb)) o
    where o ? 'inicio' and o ? 'fim'
  ), livres as (
    select s.ini_ts, s.ini_ts + make_interval(mins => dur) as fim_ts, s.dia, s.turno
    from s
    where s.ini_ts >= now() + make_interval(mins => antec)
      and not exists (
        select 1 from comercial_reunioes r
        where r.status in ('agendada','confirmada')
          and tstzrange(r.inicio, r.fim) && tstzrange(s.ini_ts, s.ini_ts + make_interval(mins => dur))
      )
      and not exists (
        select 1 from google g
        where g.gf > g.gi and tstzrange(g.gi, g.gf) && tstzrange(s.ini_ts, s.ini_ts + make_interval(mins => dur))
      )
  ), pick as (
    select x.ini_ts, x.fim_ts from (
      select l.*, row_number() over (partition by l.dia, l.turno order by l.ini_ts) as nt from livres l
    ) x where x.nt = 1
  )
  select p.ini_ts, p.fim_ts, comercial_rotulo(p.ini_ts) from pick p order by p.ini_ts limit p_limite;
end $function$
;

CREATE OR REPLACE FUNCTION public.comercial_agendar(p_session text, p_inicio timestamp with time zone, p_formato text DEFAULT 'online'::text, p_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cfg jsonb := (select jsonb_object_agg(key, value) from comercial_config);
  dur int := (cfg->>'duracao_min')::int;
  l comercial_leads;
  r comercial_reunioes;
  a jsonb;
  local_t time := (p_inicio at time zone 'America/Sao_Paulo')::time;
  valido boolean;
begin
  select * into l from comercial_leads where session_id = p_session;
  if l.id is null then
    return jsonb_build_object('ok', false, 'erro', 'lead não encontrado, chame salvar_lead antes de agendar');
  end if;

  -- Filtro: só agenda quem se encaixa (reagendamento de quem já tem reunião passa).
  if l.status <> 'agendado' then
    a := comercial_avaliar(l);
    if a->>'decisao' = 'fora_do_perfil' then
      return jsonb_build_object('ok', false, 'erro', 'lead fora do perfil (' || (a->>'motivo') || '). Não agende, faça o encerramento');
    elsif a->>'decisao' = 'morno' then
      return jsonb_build_object('ok', false, 'erro', 'lead sem momento para reunião agora (' || (a->>'motivo') || '). Não agende, mande o formulário e o site');
    elsif a->>'decisao' = 'falta_info' then
      return jsonb_build_object('ok', false, 'erro', 'antes de agendar falta saber ' || array_to_string(array(select jsonb_array_elements_text(a->'falta')), ', ') || '. Pergunte isso e depois agende');
    end if;
  end if;

  if p_inicio < now() + make_interval(mins => (cfg->>'antecedencia_min')::int) then
    return jsonb_build_object('ok', false, 'erro', 'horário muito próximo ou passado, consulte os horários de novo');
  end if;
  select exists (
    select 1 from jsonb_array_elements(cfg->'janelas') w
    where local_t >= (w->>0)::time and local_t + make_interval(mins => dur) <= (w->>1)::time
  ) and extract(isodow from p_inicio at time zone 'America/Sao_Paulo')::int in (select jsonb_array_elements_text(cfg->'dias_semana')::int)
  into valido;
  if not valido then return jsonb_build_object('ok', false, 'erro', 'fora do horário de atendimento, consulte os horários de novo'); end if;
  if exists (select 1 from comercial_reunioes x where x.status in ('agendada','confirmada') and x.lead_id <> l.id
             and tstzrange(x.inicio, x.fim) && tstzrange(p_inicio, p_inicio + make_interval(mins => dur))) then
    return jsonb_build_object('ok', false, 'erro', 'horário acabou de ser ocupado, consulte os horários de novo');
  end if;

  update comercial_reunioes set status = 'reagendada'
  where lead_id = l.id and status in ('agendada','confirmada');

  insert into comercial_reunioes (lead_id, inicio, fim, formato, responsavel)
  values (l.id, p_inicio, p_inicio + make_interval(mins => dur), coalesce(nullif(p_formato,''),'online'), cfg->>'responsavel')
  returning * into r;

  update comercial_leads set status = 'agendado', email = coalesce(nullif(lower(trim(p_email)),''), email)
  where id = l.id returning * into l;

  return jsonb_build_object(
    'ok', true,
    'reuniao_id', r.id,
    'inicio', r.inicio, 'fim', r.fim,
    'rotulo', comercial_rotulo(r.inicio),
    'formato', r.formato,
    'endereco', case when r.formato = 'presencial' then cfg->>'endereco_presencial' end,
    'responsavel', r.responsavel,
    'lead', jsonb_build_object('nome', l.nome, 'empresa', l.empresa, 'segmento', l.segmento, 'cidade', l.cidade,
      'faturamento_faixa', l.faturamento_faixa, 'colaboradores', l.colaboradores, 'dor', l.dor, 'investe_marketing', l.investe_marketing,
      'marketing_hoje', l.marketing_hoje, 'trafego_pago', l.trafego_pago, 'investimento_faixa', l.investimento_faixa,
      'decisor', l.decisor, 'urgencia', l.urgencia, 'temperatura', l.temperatura, 'score', l.score, 'score_detalhe', l.score_detalhe,
      'email', l.email, 'telefone', l.telefone, 'origem', l.origem, 'ad_id', l.ad_id, 'campanha', l.campanha,
      'estagio', l.estagio, 'pedido_tipo', l.pedido_tipo)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.app_has_total_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.comercial_registrar_mensagem(p_session text, p_direcao text, p_texto text, p_wa_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id bigint;
  v_status text;
begin
  insert into comercial_mensagens (session_id, direcao, texto, wa_id, processada)
  values (p_session, p_direcao, coalesce(p_texto, ''), nullif(p_wa_id, ''), p_direcao <> 'lead')
  on conflict (wa_id) do nothing
  returning id into v_id;
  select status into v_status from comercial_leads where session_id = p_session;
  return jsonb_build_object('ok', true, 'mensagem_id', v_id, 'duplicada', v_id is null, 'status', v_status);
end $function$
;

CREATE OR REPLACE FUNCTION public.comercial_eco(p_session text, p_texto text, p_wa_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_wa_id is not null and exists (select 1 from comercial_mensagens where wa_id = p_wa_id) then
    return jsonb_build_object('ok', true, 'ignorado', true);
  end if;
  insert into comercial_mensagens (session_id, direcao, texto, wa_id, processada)
  values (p_session, 'humano', coalesce(p_texto, ''), nullif(p_wa_id, ''), true)
  on conflict (wa_id) do nothing;
  update comercial_leads set status = 'humano', updated_at = now()
  where session_id = p_session and status <> 'humano';
  return jsonb_build_object('ok', true, 'ignorado', false, 'status', 'humano');
end $function$
;

CREATE OR REPLACE FUNCTION public.has_total_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.team_members tm
    where tm.profile_id = auth.uid()
      and tm.is_active is true
      and tm.access_type = 'total'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.generate_next_work_item_cycle(p_source_id uuid, p_client_service_id uuid, p_start_date date, p_end_date date, p_programming_verified boolean, p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid := auth.uid();

  v_source
    public.work_items%rowtype;

  v_source_column
    public.board_columns%rowtype;

  v_target_column
    public.board_columns%rowtype;

  v_service
    public.client_services%rowtype;

  v_client
    public.clients%rowtype;

  v_existing_successor uuid;
  v_new_id uuid;
  v_next_cycle_number integer;
  v_duration integer;
  v_title text;
  v_drive_link text;
  v_requirement_count integer := 0;
begin
  if v_actor is null then
    raise exception
      'Sessão inválida ou expirada.';
  end if;

  if not public.app_has_total_access() then
    raise exception
      'Somente usuários com Acesso Total podem gerar ciclos.';
  end if;

  if coalesce(trim(p_confirmation), '') <> 'GERAR CICLO' then
    raise exception
      'Confirmação de segurança inválida.';
  end if;

  if coalesce(p_programming_verified, false) is not true then
    raise exception
      'Confirme que a programação do ciclo foi concluída.';
  end if;

  if p_source_id is null then
    raise exception
      'Card de origem não informado.';
  end if;

  if p_client_service_id is null then
    raise exception
      'Selecione o serviço que define o próximo ciclo.';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception
      'Informe as datas do próximo ciclo.';
  end if;

  if p_end_date <= p_start_date then
    raise exception
      'A data final precisa ser posterior à data inicial.';
  end if;

  v_duration :=
    p_end_date - p_start_date;

  if v_duration < 1 or v_duration > 365 then
    raise exception
      'A duração do ciclo precisa estar entre 1 e 365 dias.';
  end if;

  select *
    into v_source
  from public.work_items
  where id = p_source_id
  for update;

  if not found then
    raise exception
      'Card de origem não encontrado.';
  end if;

  if v_source.board_id is null
     or v_source.board_column_id is null then
    raise exception
      'O card não está vinculado a um Quadro e coluna válidos.';
  end if;

  select *
    into v_source_column
  from public.board_columns
  where id = v_source.board_column_id
    and board_id = v_source.board_id;

  if not found then
    raise exception
      'Coluna atual do card não encontrada.';
  end if;

  if v_source_column.automation_role <> 'completed' then
    raise exception
      'Somente cards da coluna Concluído podem gerar o próximo ciclo.';
  end if;

  if v_source.status not in ('done', 'delivered') then
    raise exception
      'O card precisa estar concluído antes de gerar o próximo ciclo.';
  end if;

  if v_source.client_id is null then
    raise exception
      'O card concluído não possui cliente vinculado.';
  end if;

  select id
    into v_existing_successor
  from public.work_items
  where generated_from_cycle_id = v_source.id
  limit 1;

  if v_existing_successor is not null then
    raise exception
      'Este card já gerou um próximo ciclo.';
  end if;

  select *
    into v_service
  from public.client_services
  where id = p_client_service_id
    and client_id = v_source.client_id
    and status = 'active'
  for update;

  if not found then
    raise exception
      'O serviço selecionado não pertence ao cliente ou não está ativo.';
  end if;

  if v_service.cycle_duration_days is null then
    raise exception
      'Configure a duração do ciclo neste serviço antes de continuar.';
  end if;

  select *
    into v_client
  from public.clients
  where id = v_source.client_id
    and status = 'active';

  if not found then
    raise exception
      'Cliente não encontrado ou fora da operação.';
  end if;

  select *
    into v_target_column
  from public.board_columns
  where board_id = v_source.board_id
    and automation_role = 'alignment'
  limit 1;

  if not found then
    raise exception
      'A coluna técnica Reunião de Alinhamento não foi encontrada.';
  end if;

  if v_source.cycle_number is null then
    update public.work_items
    set
      cycle_number = 1,
      updated_at = now()
    where id = v_source.id;

    v_source.cycle_number := 1;
  end if;

  v_next_cycle_number :=
    v_source.cycle_number + 1;

  v_title :=
    trim(v_client.name)
    || ' — '
    || to_char(p_start_date, 'DD/MM')
    || '–'
    || to_char(p_end_date, 'DD/MM');

  v_drive_link :=
    coalesce(
      nullif(
        trim(v_source.drive_link),
        ''
      ),
      nullif(
        trim(v_client.drive_folder_url),
        ''
      )
    );

  insert into public.work_items (
    title,
    description,
    type,
    origin,
    destino,
    status,
    priority,

    client_id,
    client_service_id,
    responsible_id,

    board_id,
    board_column_id,

    internal_deadline,
    final_deadline,

    drive_link,
    notes,
    blocked_reason,

    created_by,
    closed_at,

    generated_from_cycle_id,
    cycle_number,
    cycle_duration_days_snapshot,
    generated_at,
    generated_by
  )
  values (
    v_title,
    null,
    coalesce(
      v_source.type,
      'Planejamento'
    ),
    coalesce(
      v_source.origin,
      'planned'
    ),
    'quadro',
    v_target_column.operational_status,
    coalesce(
      v_source.priority,
      'normal'
    ),

    v_source.client_id,
    v_service.id,
    v_source.responsible_id,

    v_source.board_id,
    v_target_column.id,

    p_start_date,
    p_end_date,

    v_drive_link,
    null,
    null,

    v_actor,
    null,

    v_source.id,
    v_next_cycle_number,
    v_duration,
    now(),
    v_actor
  )
  returning id
    into v_new_id;

  if v_service.requires_alignment_meeting then
    insert into
      public.work_item_schedule_requirements (
        work_item_id,
        requirement_type,
        status,
        calendar_type,
        created_by
      )
    values (
      v_new_id,
      'alignment_meeting',
      'pending',
      'reu_a',
      v_actor
    );

    v_requirement_count :=
      v_requirement_count + 1;
  end if;

  if v_service.requires_capture then
    insert into
      public.work_item_schedule_requirements (
        work_item_id,
        requirement_type,
        status,
        calendar_type,
        created_by
      )
    values (
      v_new_id,
      'capture',
      'pending',
      v_service.default_capture_type,
      v_actor
    );

    v_requirement_count :=
      v_requirement_count + 1;
  end if;

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    v_source.id,
    v_actor,
    'cycle_generated',
    null,
    v_new_id::text
  );

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    v_new_id,
    v_actor,
    'generated_from_cycle',
    v_source.id::text,
    v_title
  );

  return jsonb_build_object(
    'success',
    true,

    'source_id',
    v_source.id,

    'new_id',
    v_new_id,

    'title',
    v_title,

    'cycle_number',
    v_next_cycle_number,

    'start_date',
    p_start_date,

    'end_date',
    p_end_date,

    'duration_days',
    v_duration,

    'configured_duration_days',
    v_service.cycle_duration_days,

    'requirements_created',
    v_requirement_count,

    'drive_link',
    v_drive_link
  );

exception
  when unique_violation then
    raise exception
      'Este card já gerou um próximo ciclo.';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.comercial_lote(p_session text, p_ultimo bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_max bigint;
  v_min bigint;
  v_novas text;
  v_hist text;
  v_status text;
begin
  perform pg_advisory_xact_lock(hashtext('comercial_lote:' || p_session));

  select max(id) into v_max from comercial_mensagens where session_id = p_session and direcao = 'lead';
  if v_max is null or v_max > p_ultimo then
    return jsonb_build_object('processar', false, 'motivo', 'chegou mensagem mais nova');
  end if;

  select min(id), string_agg(texto, E'\n' order by id) into v_min, v_novas
  from comercial_mensagens where session_id = p_session and direcao = 'lead' and not processada;
  if v_novas is null then
    return jsonb_build_object('processar', false, 'motivo', 'já respondido');
  end if;

  update comercial_mensagens set processada = true
  where session_id = p_session and direcao = 'lead' and not processada;

  select status into v_status from comercial_leads where session_id = p_session;
  if v_status = 'humano' then
    return jsonb_build_object('processar', false, 'motivo', 'atendimento humano');
  end if;

  select string_agg(
           case direcao when 'lead' then 'Lead: ' when 'alfredo' then 'Alfredo: ' else 'Equipe Ampy: ' end || texto,
           E'\n' order by id)
    into v_hist
  from (select id, direcao, texto from comercial_mensagens
        where session_id = p_session and id < v_min
        order by id desc limit 40) t;

  return jsonb_build_object(
    'processar', true,
    'novas', v_novas,
    'historico', coalesce(v_hist, ''),
    'primeira_conversa', v_hist is null,
    'status', v_status
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    avatar_initials,
    avatar_color,
    avatar_bg,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'admin',
    UPPER(LEFT(split_part(NEW.email, '@', 1), 2)),
    '#CC8800',
    '#1A1200',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.comercial_avaliar(l comercial_leads)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  cfg jsonb := (select jsonb_object_agg(key, value) from comercial_config);
  corte text := nullif(cfg->>'corte_investimento', '');
  exigir_decisor boolean := coalesce((cfg->>'exigir_decisor')::boolean, true);
  rank_inv int := case l.investimento_faixa when 'ate_1k' then 1 when '1k_3k' then 2 when '3k_5k' then 3 when 'acima_5k' then 4 end;
  rank_corte int := case corte when 'ate_1k' then 1 when '1k_3k' then 2 when '3k_5k' then 3 when 'acima_5k' then 4 end;
  motivo text;
  falta text[] := array[]::text[];
begin
  if l.estagio = 'abrindo' then motivo := 'a empresa ainda não está funcionando';
  elsif l.estagio = 'pessoa_fisica' then motivo := 'não tem empresa, é perfil pessoal';
  elsif l.pedido_tipo = 'avulso' then motivo := 'procura serviço avulso, a Ampy trabalha com acompanhamento mensal';
  elsif rank_corte is not null and rank_inv is not null and rank_inv < rank_corte then motivo := 'investimento abaixo do mínimo';
  elsif exigir_decisor and l.decisor = 'nao' then motivo := 'não decide e quem decide não participa';
  end if;

  if motivo is not null then
    return jsonb_build_object('decisao', 'fora_do_perfil', 'motivo', motivo, 'falta', '[]'::jsonb);
  end if;

  -- Curioso: sem previsão de começar não ganha reunião, recebe formulário e site.
  if l.urgencia = 'sem_prazo' then
    return jsonb_build_object('decisao', 'morno', 'motivo', 'sem previsão para começar, ainda entendendo as possibilidades', 'falta', '[]'::jsonb);
  end if;

  if l.dor is null then falta := array_append(falta, 'motivo do contato'::text); end if;
  if l.empresa is null then falta := array_append(falta, 'empresa'::text); end if;
  if l.estagio is null then falta := array_append(falta, 'se a empresa já está funcionando'::text); end if;
  if l.investimento_faixa is null then falta := array_append(falta, 'investimento'::text); end if;
  if l.urgencia is null then falta := array_append(falta, 'quando quer começar'::text); end if;
  if exigir_decisor and l.decisor is null then falta := array_append(falta, 'quem decide'::text); end if;

  if cardinality(falta) > 0 then
    return jsonb_build_object('decisao', 'falta_info', 'motivo', null, 'falta', to_jsonb(falta));
  end if;
  return jsonb_build_object('decisao', 'pode_agendar', 'motivo', null, 'falta', '[]'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.app_current_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true $function$
;

CREATE OR REPLACE FUNCTION public.app_is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT COALESCE(app_current_role() IN ('admin','director','manager','team_lead'), false) $function$
;

CREATE OR REPLACE FUNCTION public.app_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT COALESCE(app_current_role() IN ('admin','director'), false) $function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.comercial_tel_chave(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case when length(d) >= 10 then substr(d, 1, 2) || right(d, 8) end
  from (select case when length(x) >= 12 and left(x, 2) = '55' then substr(x, 3) else x end as d
        from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as x) a) b
$function$
;

CREATE OR REPLACE FUNCTION public.comercial_formulario(p_response_id text, p_dados jsonb, p_session_hint text DEFAULT NULL::text, p_payload jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session text;
  v_tel text;
  novo boolean := false;
  status_antes text;
  dados jsonb := coalesce(p_dados, '{}'::jsonb);
  -- "texto.. Marcou" vira "texto. Marcou"
  l comercial_leads;
begin
  if dados ? 'dor' then
    dados := jsonb_set(dados, '{dor}', to_jsonb(regexp_replace(dados->>'dor', '[.!?]+\.\s', '. ', 'g')));
  end if;
  if coalesce(p_response_id, '') = '' then
    return jsonb_build_object('ok', false, 'erro', 'response_id obrigatório');
  end if;

  insert into comercial_formularios (response_id, dados, payload) values (p_response_id, dados, p_payload)
  on conflict (response_id) do nothing;
  if not found then
    return jsonb_build_object('ok', true, 'duplicado', true);
  end if;

  if coalesce(p_session_hint, '') <> '' then
    select session_id into v_session from comercial_leads where session_id = p_session_hint;
  end if;
  if v_session is null and comercial_tel_chave(dados->>'telefone') is not null then
    select session_id into v_session from comercial_leads
    where comercial_tel_chave(telefone) = comercial_tel_chave(dados->>'telefone')
    order by updated_at desc limit 1;
  end if;

  if v_session is null then
    v_session := 'form_' || p_response_id;
    novo := true;
  else
    select status, telefone into status_antes, v_tel from comercial_leads where session_id = v_session;
    -- O telefone do WhatsApp é o que o Alfredo usa para responder: não troca pelo digitado no formulário.
    if v_tel is not null then dados := dados - 'telefone'; end if;
  end if;

  l := comercial_salvar_lead(v_session, dados || jsonb_build_object('canal', 'formulario', 'origem', 'formulario'));
  update comercial_leads set formulario_respondido_em = now() where session_id = v_session returning * into l;
  update comercial_formularios set session_id = v_session where response_id = p_response_id;

  return jsonb_build_object('ok', true, 'duplicado', false, 'lead_novo', novo, 'status_antes', status_antes, 'lead', to_jsonb(l));
end $function$
;

CREATE OR REPLACE FUNCTION public.comercial_pontuar(l comercial_leads)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare
  p_colab int := case
    when l.colaboradores is null then null
    when l.colaboradores <= 5 then 5
    when l.colaboradores <= 10 then 15
    when l.colaboradores <= 20 then 22
    else 25 end;
  p_fat int := case l.faturamento_faixa
    when 'acima_100k' then 25 when '50k_100k' then 22 when '20k_50k' then 12 when 'ate_20k' then 5 end;
  p_porte int := greatest(p_colab, p_fat);
  p_mkt int := case l.marketing_hoje
    when 'agencia_freela' then 15 when 'equipe_interna' then 12 when 'ja_trabalhou' then 10 when 'sozinho' then 6 when 'pontual' then 6 when 'nunca' then 0 end;
  p_traf int := case l.trafego_pago
    when 'atualmente' then 15 when 'ja_investiu' then 8 when 'nunca' then 0 when 'nao_sabe' then 0 end;
  p_inv int := case l.investimento_faixa
    when 'acima_5k' then 25 when '3k_5k' then 18 when '1k_3k' then 10 when 'ate_1k' then 3 when 'nao_definido' then 3 end;
  p_urg int := case l.urgencia
    when 'imediato' then 15 when '30_dias' then 15 when '90_dias' then 8 when 'sem_prazo' then 2 end;
  p_dec int := case l.decisor
    when 'sim' then 5 when 'participa' then 5 when 'nao' then 0 end;
  total int := coalesce(p_porte,0) + coalesce(p_mkt,0) + coalesce(p_traf,0) + coalesce(p_inv,0) + coalesce(p_urg,0) + coalesce(p_dec,0);
  faltando text[] := array_remove(array[
    case when p_porte is null then 'porte' end,
    case when p_mkt is null then 'marketing_hoje' end,
    case when p_traf is null then 'trafego_pago' end,
    case when p_inv is null then 'investimento_faixa' end,
    case when p_urg is null then 'urgencia' end,
    case when p_dec is null then 'decisor' end
  ], null);
begin
  return jsonb_build_object(
    'score', total,
    'temperatura', case when total >= 65 then 'quente' when total >= 40 then 'morno' else 'frio' end,
    'pontos', jsonb_build_object(
      'porte', p_porte, 'marketing_hoje', p_mkt, 'trafego_pago', p_traf,
      'investimento', p_inv, 'urgencia', p_urg, 'decisor', p_dec),
    'faltando', to_jsonb(faltando)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.app_is_active_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true) $function$
;

CREATE OR REPLACE FUNCTION public.app_validate_work_item_links()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE service_client UUID;
BEGIN
  IF NEW.client_service_id IS NOT NULL THEN
    IF NEW.client_id IS NULL THEN
      RAISE EXCEPTION 'Serviço vinculado exige cliente na demanda.';
    END IF;
    SELECT client_id INTO service_client FROM client_services WHERE id = NEW.client_service_id;
    IF service_client IS NULL THEN
      RAISE EXCEPTION 'Serviço vinculado não encontrado.';
    END IF;
    IF service_client <> NEW.client_id THEN
      RAISE EXCEPTION 'Serviço vinculado não pertence ao cliente da demanda.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.app_validate_calendar_links()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE demand_client UUID;
BEGIN
  IF NEW.work_item_id IS NOT NULL THEN
    SELECT client_id INTO demand_client FROM work_items WHERE id = NEW.work_item_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Demanda vinculada ao evento não encontrada.';
    END IF;
    IF NEW.client_id IS NOT NULL AND demand_client IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'Cliente do evento não corresponde ao cliente da demanda.';
    END IF;
    IF NEW.client_id IS NULL AND demand_client IS NOT NULL THEN
      NEW.client_id := demand_client;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_calendar_event_pauta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_work_item_pauta_id uuid;
begin
  if new.work_item_id is not null then
    select item.pauta_id
      into v_work_item_pauta_id
    from public.work_items as item
    where item.id = new.work_item_id;

    if not found then
      raise exception
        'Demanda vinculada à agenda não encontrada.';
    end if;

    if new.pauta_id is not null
       and new.pauta_id is distinct from v_work_item_pauta_id then
      raise exception
        'A Pauta da agenda não corresponde à Pauta da demanda vinculada.';
    end if;

    new.pauta_id := v_work_item_pauta_id;
  end if;

  if new.pauta_id is not null
     and not exists (
       select 1
       from public.pautas as pauta
       where pauta.id = new.pauta_id
         and pauta.archived_at is null
     ) then
    raise exception
      'A Pauta vinculada à agenda não está disponível.';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.open_monthly_pauta(p_board_id uuid, p_name text, p_reference_month date, p_magic_number_date date, p_scheduled_until_date date, p_client_ids uuid[], p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_board public.boards%rowtype;
  v_existing_pauta public.pautas%rowtype;
  v_pauta_id uuid;
  v_client_id uuid;
  v_result jsonb;

  v_selected_count integer := 0;
  v_unique_count integer := 0;
  v_active_count integer := 0;
  v_cards_created integer := 0;
  v_memberships_created integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'ABRIR PAUTA' then
    raise exception
      'Confirmação inválida. Digite ABRIR PAUTA.';
  end if;

  if p_board_id is null then
    raise exception 'Quadro obrigatório.';
  end if;

  if length(trim(coalesce(p_name, ''))) not between 3 and 120 then
    raise exception
      'O nome da Pauta deve possuir entre 3 e 120 caracteres.';
  end if;

  if p_reference_month is null
     or p_reference_month <>
        date_trunc(
          'month',
          p_reference_month
        )::date
  then
    raise exception
      'O mês de referência deve utilizar o primeiro dia do mês.';
  end if;

  if p_magic_number_date is null
     or p_scheduled_until_date is null
  then
    raise exception
      'Magic Number e Programado até são obrigatórios.';
  end if;

  if p_magic_number_date > p_scheduled_until_date then
    raise exception
      'O Magic Number não pode ser posterior à data Programado até.';
  end if;

  if p_scheduled_until_date < p_reference_month then
    raise exception
      'A data Programado até precisa alcançar o mês de referência.';
  end if;

  if p_client_ids is null
     or cardinality(p_client_ids) = 0
  then
    raise exception
      'Selecione pelo menos um cliente ativo.';
  end if;

  if cardinality(p_client_ids) > 300 then
    raise exception
      'A Pauta aceita no máximo 300 clientes por abertura.';
  end if;

  if exists (
    select 1
    from unnest(p_client_ids) as selected(client_id)
    where selected.client_id is null
  ) then
    raise exception
      'A seleção contém cliente inválido.';
  end if;

  select
    count(*),
    count(distinct selected.client_id)
  into
    v_selected_count,
    v_unique_count
  from unnest(p_client_ids) as selected(client_id);

  if v_selected_count <> v_unique_count then
    raise exception
      'A seleção contém clientes duplicados.';
  end if;

  select *
  into v_board
  from public.boards
  where id = p_board_id
    and status = 'active'
    and board_kind = 'pauta'
  for update;

  if not found then
    raise exception
      'A Pauta deve ser aberta em um Quadro ativo do tipo Pauta.';
  end if;

  select *
  into v_existing_pauta
  from public.pautas
  where board_id = p_board_id
    and reference_month = p_reference_month
  limit 1;

  if found then
    return jsonb_build_object(
      'success', false,
      'code', 'PAUTA_EXISTS',
      'existing_pauta_unchanged', true,
      'message', 'Já existe uma Pauta para este mês.',
      'pauta_id', v_existing_pauta.id,
      'pauta_name', v_existing_pauta.name,
      'reference_month', v_existing_pauta.reference_month,
      'lifecycle_status', v_existing_pauta.lifecycle_status,
      'cards_created', 0
    );
  end if;

  select count(*)
  into v_active_count
  from public.clients
  where id = any(p_client_ids)
    and status = 'active';

  if v_active_count <> v_unique_count then
    raise exception
      'Um ou mais clientes selecionados não existem ou estão inativos.';
  end if;

  insert into public.pautas (
    board_id,
    name,
    reference_month,
    magic_number_date,
    scheduled_until_date,
    lifecycle_status,
    opened_at,
    created_by
  )
  values (
    p_board_id,
    trim(p_name),
    p_reference_month,
    p_magic_number_date,
    p_scheduled_until_date,
    'open',
    now(),
    v_actor
  )
  returning id
  into v_pauta_id;

  for v_client_id in
    select client.id
    from public.clients as client
    where client.id = any(p_client_ids)
      and client.status = 'active'
    order by client.name
  loop
    v_result :=
      public.pauta_create_main_card_core(
        v_pauta_id,
        v_client_id,
        v_actor,
        'opened'
      );

    if coalesce(
      (v_result ->> 'created')::boolean,
      false
    ) then
      v_cards_created :=
        v_cards_created + 1;
    end if;

    if coalesce(
      (v_result ->> 'membership_created')::boolean,
      false
    ) then
      v_memberships_created :=
        v_memberships_created + 1;
    end if;
  end loop;

  perform public.pauta_log_event(
    v_pauta_id,
    p_board_id,
    v_actor,
    'pauta_created',
    'pauta',
    v_pauta_id,
    '{}'::jsonb,
    jsonb_build_object(
      'name', trim(p_name),
      'reference_month', p_reference_month,
      'magic_number_date', p_magic_number_date,
      'scheduled_until_date', p_scheduled_until_date,
      'cards_created', v_cards_created,
      'memberships_created', v_memberships_created
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'code', 'PAUTA_CREATED',
    'pauta_id', v_pauta_id,
    'cards_created', v_cards_created,
    'memberships_created', v_memberships_created,
    'reference_month', p_reference_month,
    'magic_number_date', p_magic_number_date,
    'scheduled_until_date', p_scheduled_until_date
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pauta_log_event(p_pauta_id uuid, p_board_id uuid, p_actor_id uuid, p_action text, p_target_type text, p_target_id uuid, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_event_id uuid;
  v_action text := trim(coalesce(p_action, ''));
  v_target_type text := coalesce(
    nullif(trim(p_target_type), ''),
    'pauta'
  );
begin
  if length(v_action) not between 2 and 80 then
    raise exception
      'Ação inválida para o histórico da Pauta.';
  end if;

  if v_target_type not in (
    'pauta',
    'client',
    'work_item',
    'member',
    'board'
  ) then
    raise exception
      'Tipo de alvo inválido para o histórico da Pauta.';
  end if;

  insert into public.pauta_events (
    pauta_id,
    board_id,
    actor_id,
    action,
    target_type,
    target_id,
    old_values,
    new_values,
    metadata
  )
  values (
    p_pauta_id,
    p_board_id,
    p_actor_id,
    v_action,
    v_target_type,
    p_target_id,
    coalesce(p_old_values, '{}'::jsonb),
    coalesce(p_new_values, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id
  into v_event_id;

  return v_event_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.app_log_feed_board_created()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO feed_board_events (
    board_id,
    actor_type,
    actor_id,
    actor_name,
    event_type,
    message
  )
  VALUES (
    NEW.id,
    'internal',
    NEW.created_by,
    'Ampy Digital',
    'board_created',
    'Ampy Digital criou o documento de aprovação.'
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_pauta_settings(p_pauta_id uuid, p_name text, p_magic_number_date date, p_scheduled_until_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_old_values jsonb;
  v_new_values jsonb;
  v_updated_cards integer := 0;
begin
  v_actor := public.pauta_management_actor();

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in ('draft', 'open') then
    raise exception
      'Somente Pautas abertas ou em rascunho podem ser editadas.';
  end if;

  if length(v_name) not between 3 and 120 then
    raise exception
      'O nome da Pauta deve possuir entre 3 e 120 caracteres.';
  end if;

  if p_magic_number_date is null
     or p_scheduled_until_date is null
  then
    raise exception
      'Magic Number e Programado até são obrigatórios.';
  end if;

  if p_magic_number_date > p_scheduled_until_date then
    raise exception
      'O Magic Number não pode ser posterior à data Programado até.';
  end if;

  v_old_values := jsonb_build_object(
    'name', v_pauta.name,
    'magic_number_date', v_pauta.magic_number_date,
    'scheduled_until_date', v_pauta.scheduled_until_date
  );

  update public.pautas
  set
    name = v_name,
    magic_number_date = p_magic_number_date,
    scheduled_until_date = p_scheduled_until_date,
    updated_at = now()
  where id = p_pauta_id;

  update public.work_items item
  set
    internal_deadline = p_magic_number_date,
    final_deadline = coalesce(
      member.target_date,
      p_scheduled_until_date
    ),
    updated_at = now()
  from public.pauta_members member
  where member.pauta_id = p_pauta_id
    and member.membership_status = 'active'
    and item.id = member.main_work_item_id
    and item.status not in ('archived', 'cancelled');

  get diagnostics v_updated_cards = row_count;

  v_new_values := jsonb_build_object(
    'name', v_name,
    'magic_number_date', p_magic_number_date,
    'scheduled_until_date', p_scheduled_until_date
  );

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'settings_updated',
    'pauta',
    p_pauta_id,
    v_old_values,
    v_new_values,
    jsonb_build_object(
      'main_cards_updated', v_updated_cards,
      'individual_target_dates_preserved', true
    )
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'cards_updated', v_updated_cards,
    'settings', v_new_values
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_active_pauta_work_item_requires_pauta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_board_kind text;
begin
  if new.board_id is null then
    return new;
  end if;

  select board_kind into v_board_kind
  from public.boards
  where id = new.board_id;

  if v_board_kind = 'pauta'
     and new.pauta_id is null
     and new.status not in ('archived','cancelled')
  then
    raise exception 'Demandas ativas do Quadro operacional precisam pertencer a uma Pauta.';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.add_clients_to_pauta(p_pauta_id uuid, p_client_ids uuid[], p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_client_id uuid;
  v_result jsonb;
  v_added integer := 0;
  v_already_present integer := 0;
  v_without_services integer := 0;
  v_legacy_conflicts integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'ADICIONAR CLIENTES' then
    raise exception
      'Confirmação inválida. Digite ADICIONAR CLIENTES.';
  end if;

  if p_client_ids is null
     or cardinality(p_client_ids) = 0
  then
    raise exception
      'Selecione pelo menos um cliente.';
  end if;

  if cardinality(p_client_ids) > 300 then
    raise exception
      'É permitido incluir no máximo 300 clientes por operação.';
  end if;

  if exists (
    select 1
    from unnest(p_client_ids) as selected(client_id)
    where selected.client_id is null
  ) then
    raise exception
      'A seleção contém cliente inválido.';
  end if;

  if (
    select count(*)
    from unnest(p_client_ids)
  ) <> (
    select count(distinct client_id)
    from unnest(p_client_ids) as selected(client_id)
  ) then
    raise exception
      'A seleção contém clientes duplicados.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in (
    'draft',
    'open'
  ) then
    raise exception
      'Somente Pautas abertas ou em rascunho podem receber clientes.';
  end if;

  if exists (
    select 1
    from unnest(p_client_ids) as selected(client_id)
    left join public.clients as client
      on client.id = selected.client_id
    where client.id is null
       or client.status <> 'active'
  ) then
    raise exception
      'Um ou mais clientes selecionados não existem ou estão inativos.';
  end if;

  select count(*)
  into v_legacy_conflicts
  from unnest(p_client_ids) as selected(client_id)
  where not exists (
    select 1
    from public.pauta_members as member
    where member.pauta_id = p_pauta_id
      and member.client_id = selected.client_id
      and member.membership_status = 'active'
  )
  and exists (
    select 1
    from public.work_items as legacy
    where legacy.board_id = v_pauta.board_id
      and legacy.pauta_id is null
      and legacy.client_id = selected.client_id
      and legacy.is_pauta_card = false
      and legacy.status not in (
        'archived',
        'cancelled'
      )
  );

  if v_legacy_conflicts > 0 then
    raise exception
      'A seleção possui % cliente(s) com card legado. Use a adoção de cards legados para evitar duplicidade.',
      v_legacy_conflicts;
  end if;

  for v_client_id in
    select distinct selected.client_id
    from unnest(p_client_ids) as selected(client_id)
  loop
    if exists (
      select 1
      from public.pauta_members as member
      where member.pauta_id = p_pauta_id
        and member.client_id = v_client_id
        and member.membership_status = 'active'
    ) then
      v_already_present := v_already_present + 1;
      continue;
    end if;

    if not exists (
      select 1
      from public.client_services as service
      where service.client_id = v_client_id
        and service.status = 'active'
    ) then
      v_without_services := v_without_services + 1;
    end if;

    v_result :=
      public.pauta_create_main_card_core(
        p_pauta_id,
        v_client_id,
        v_actor,
        'added'
      );

    if coalesce(
      (v_result ->> 'membership_created')::boolean,
      false
    ) then
      v_added := v_added + 1;
    else
      v_already_present := v_already_present + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'clients_added', v_added,
    'clients_already_present', v_already_present,
    'clients_without_active_service', v_without_services,
    'legacy_conflicts', 0
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.adopt_legacy_cards_to_pauta(p_pauta_id uuid, p_mapping jsonb, p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;

  v_entry jsonb;
  v_client_id uuid;
  v_main_work_item_id uuid;
  v_extra_ids jsonb;

  v_main_item public.work_items%rowtype;
  v_extra_item public.work_items%rowtype;

  v_extra_id uuid;
  v_member_id uuid;

  v_clients_adopted integer := 0;
  v_main_cards_adopted integer := 0;
  v_extra_demands_adopted integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'ADOTAR LEGADO' then
    raise exception
      'Confirmação inválida. Digite ADOTAR LEGADO.';
  end if;

  if p_mapping is null
     or jsonb_typeof(p_mapping) <> 'array'
     or jsonb_array_length(p_mapping) = 0
  then
    raise exception
      'Informe um mapping não vazio em formato de array JSON.';
  end if;

  if jsonb_array_length(p_mapping) > 300 then
    raise exception
      'É permitido adotar no máximo 300 clientes por operação.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in (
    'draft',
    'open'
  ) then
    raise exception
      'Somente Pautas abertas ou em rascunho podem adotar cards legados.';
  end if;

  if exists (
    select 1
    from (
      select
        entry ->> 'client_id' as client_id,
        count(*) as total
      from jsonb_array_elements(p_mapping) as mapping(entry)
      group by entry ->> 'client_id'
      having count(*) > 1
    ) as duplicated
  ) then
    raise exception
      'O mapping contém o mesmo cliente mais de uma vez.';
  end if;

  if exists (
    select 1
    from (
      select
        entry ->> 'main_work_item_id' as work_item_id,
        count(*) as total
      from jsonb_array_elements(p_mapping) as mapping(entry)
      group by entry ->> 'main_work_item_id'
      having count(*) > 1
    ) as duplicated
  ) then
    raise exception
      'O mapping contém o mesmo card principal mais de uma vez.';
  end if;

  -- Toda validação ocorre dentro da mesma função/transação.
  -- Qualquer exceção reverte todas as adoções da chamada.

  for v_entry in
    select entry
    from jsonb_array_elements(p_mapping) as mapping(entry)
  loop
    if jsonb_typeof(v_entry) <> 'object' then
      raise exception
        'Cada item do mapping deve ser um objeto JSON.';
    end if;

    begin
      v_client_id :=
        nullif(
          trim(v_entry ->> 'client_id'),
          ''
        )::uuid;

      v_main_work_item_id :=
        nullif(
          trim(v_entry ->> 'main_work_item_id'),
          ''
        )::uuid;
    exception
      when invalid_text_representation then
        raise exception
          'O mapping contém UUID inválido.';
    end;

    if v_client_id is null
       or v_main_work_item_id is null
    then
      raise exception
        'client_id e main_work_item_id são obrigatórios.';
    end if;

    v_extra_ids := coalesce(
      v_entry -> 'extra_work_item_ids',
      '[]'::jsonb
    );

    if jsonb_typeof(v_extra_ids) <> 'array' then
      raise exception
        'extra_work_item_ids deve ser um array JSON.';
    end if;

    if not exists (
      select 1
      from public.clients
      where id = v_client_id
        and status = 'active'
    ) then
      raise exception
        'Cliente % não existe ou está inativo.',
        v_client_id;
    end if;

    if exists (
      select 1
      from public.pauta_members
      where pauta_id = p_pauta_id
        and client_id = v_client_id
        and membership_status = 'active'
    ) then
      raise exception
        'O cliente % já participa da Pauta.',
        v_client_id;
    end if;

    if exists (
      select 1
      from public.work_items
      where pauta_id = p_pauta_id
        and client_id = v_client_id
        and is_pauta_card = true
    ) then
      raise exception
        'O cliente % já possui card principal nesta Pauta.',
        v_client_id;
    end if;

    select *
    into v_main_item
    from public.work_items
    where id = v_main_work_item_id
    for update;

    if not found then
      raise exception
        'Card principal legado % não encontrado.',
        v_main_work_item_id;
    end if;

    if v_main_item.client_id is distinct from v_client_id then
      raise exception
        'O card principal % não pertence ao cliente informado.',
        v_main_work_item_id;
    end if;

    if v_main_item.board_id is distinct from v_pauta.board_id then
      raise exception
        'O card principal % não pertence ao Quadro da Pauta.',
        v_main_work_item_id;
    end if;

    if v_main_item.pauta_id is not null then
      raise exception
        'O card principal % já pertence a outra Pauta.',
        v_main_work_item_id;
    end if;

    if v_main_item.is_pauta_card = true
       or v_main_item.pauta_card_id is not null
    then
      raise exception
        'O card principal % já possui contexto de Pauta.',
        v_main_work_item_id;
    end if;

    if v_main_item.status in (
      'archived',
      'cancelled'
    ) then
      raise exception
        'O card principal % está arquivado ou cancelado.',
        v_main_work_item_id;
    end if;

    if v_main_item.board_column_id is null
       or not exists (
         select 1
         from public.board_columns as column_row
         where column_row.id = v_main_item.board_column_id
           and column_row.board_id = v_pauta.board_id
       )
    then
      raise exception
        'O card principal % não possui coluna válida no Quadro da Pauta.',
        v_main_work_item_id;
    end if;

    if exists (
      select 1
      from (
        select
          value::text as extra_id,
          count(*) as total
        from jsonb_array_elements_text(v_extra_ids)
        group by value::text
        having count(*) > 1
      ) as duplicate_extra
    ) then
      raise exception
        'A lista de extras do cliente % contém UUID repetido.',
        v_client_id;
    end if;

    for v_extra_id in
      select value::uuid
      from jsonb_array_elements_text(v_extra_ids)
    loop
      if v_extra_id = v_main_work_item_id then
        raise exception
          'O card principal não pode aparecer como demanda extra.';
      end if;

      select *
      into v_extra_item
      from public.work_items
      where id = v_extra_id
      for update;

      if not found then
        raise exception
          'Demanda extra legada % não encontrada.',
          v_extra_id;
      end if;

      if v_extra_item.client_id is distinct from v_client_id then
        raise exception
          'A demanda extra % não pertence ao cliente informado.',
          v_extra_id;
      end if;

      if v_extra_item.board_id is distinct from v_pauta.board_id then
        raise exception
          'A demanda extra % não pertence ao Quadro da Pauta.',
          v_extra_id;
      end if;

      if v_extra_item.pauta_id is not null
         or v_extra_item.is_pauta_card = true
         or v_extra_item.pauta_card_id is not null
      then
        raise exception
          'A demanda extra % já possui contexto de Pauta.',
          v_extra_id;
      end if;

      if v_extra_item.status in (
        'archived',
        'cancelled'
      ) then
        raise exception
          'A demanda extra % está arquivada ou cancelada.',
          v_extra_id;
      end if;

      if v_extra_item.board_column_id is null
         or not exists (
           select 1
           from public.board_columns as column_row
           where column_row.id = v_extra_item.board_column_id
             and column_row.board_id = v_pauta.board_id
         )
      then
        raise exception
          'A demanda extra % não possui coluna válida no Quadro da Pauta.',
          v_extra_id;
      end if;
    end loop;

    update public.work_items
    set
      pauta_id = p_pauta_id,
      is_pauta_card = true,
      pauta_card_id = null,
      updated_at = now()
    where id = v_main_work_item_id;

    insert into public.pauta_members (
      pauta_id,
      client_id,
      main_work_item_id,
      membership_status,
      source,
      added_by,
      added_at,
      metadata
    )
    values (
      p_pauta_id,
      v_client_id,
      v_main_work_item_id,
      'active',
      'legacy_adopted',
      v_actor,
      now(),
      jsonb_build_object(
        'migration',
        'V7-A3.4C.2A-R1',
        'preserved_column',
        v_main_item.board_column_id,
        'preserved_status',
        v_main_item.status,
        'preserved_internal_deadline',
        v_main_item.internal_deadline,
        'preserved_final_deadline',
        v_main_item.final_deadline
      )
    )
    returning id
    into v_member_id;

    insert into public.work_item_history (
      work_item_id,
      actor_id,
      field_changed,
      old_value,
      new_value
    )
    values (
      v_main_work_item_id,
      v_actor,
      'legacy_card_adopted',
      jsonb_build_object(
        'pauta_id', null,
        'is_pauta_card', false,
        'pauta_card_id', null
      )::text,
      jsonb_build_object(
        'pauta_id', p_pauta_id,
        'is_pauta_card', true,
        'pauta_card_id', null
      )::text
    );

    update public.calendar_events
    set
      pauta_id = p_pauta_id,
      updated_at = now()
    where work_item_id = v_main_work_item_id;

    for v_extra_id in
      select value::uuid
      from jsonb_array_elements_text(v_extra_ids)
    loop
      update public.work_items
      set
        pauta_id = p_pauta_id,
        is_pauta_card = false,
        pauta_card_id = v_main_work_item_id,
        updated_at = now()
      where id = v_extra_id;

      update public.calendar_events
      set
        pauta_id = p_pauta_id,
        updated_at = now()
      where work_item_id = v_extra_id;

      insert into public.work_item_history (
        work_item_id,
        actor_id,
        field_changed,
        old_value,
        new_value
      )
      values (
        v_extra_id,
        v_actor,
        'legacy_demand_adopted',
        jsonb_build_object(
          'pauta_id', null,
          'pauta_card_id', null
        )::text,
        jsonb_build_object(
          'pauta_id', p_pauta_id,
          'pauta_card_id', v_main_work_item_id
        )::text
      );

      v_extra_demands_adopted :=
        v_extra_demands_adopted + 1;
    end loop;

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      v_actor,
      'legacy_card_adopted',
      'client',
      v_client_id,
      jsonb_build_object(
        'main_work_item_id',
        v_main_work_item_id,
        'pauta_id',
        null
      ),
      jsonb_build_object(
        'member_id',
        v_member_id,
        'main_work_item_id',
        v_main_work_item_id,
        'pauta_id',
        p_pauta_id,
        'extra_work_item_ids',
        v_extra_ids
      ),
      jsonb_build_object(
        'preserved_work_item_ids',
        true,
        'preserved_columns',
        true,
        'preserved_deadlines',
        true,
        'preserved_statuses',
        true
      )
    );

    v_clients_adopted :=
      v_clients_adopted + 1;

    v_main_cards_adopted :=
      v_main_cards_adopted + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'clients_adopted', v_clients_adopted,
    'main_cards_adopted', v_main_cards_adopted,
    'extra_demands_adopted', v_extra_demands_adopted,
    'work_items_duplicated', 0
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_avisos_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.detach_pauta_demand(p_pauta_id uuid, p_work_item_id uuid, p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_item public.work_items%rowtype;
  v_old_values jsonb;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'RETIRAR DEMANDA' then
    raise exception
      'Confirmação inválida. Digite RETIRAR DEMANDA.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in (
    'draft',
    'open'
  ) then
    raise exception
      'Somente Pautas abertas ou em rascunho podem retirar demandas.';
  end if;

  select *
  into v_item
  from public.work_items
  where id = p_work_item_id
    and pauta_id = p_pauta_id
  for update;

  if not found then
    raise exception
      'Demanda não encontrada dentro desta Pauta.';
  end if;

  if v_item.is_pauta_card = true then
    raise exception
      'O card mensal principal deve ser tratado pela ação Retirar cliente.';
  end if;

  v_old_values := jsonb_build_object(
    'pauta_id', v_item.pauta_id,
    'pauta_card_id', v_item.pauta_card_id,
    'board_id', v_item.board_id,
    'board_column_id', v_item.board_column_id,
    'destino', v_item.destino
  );

  update public.calendar_events
  set
    pauta_id = null,
    updated_at = now()
  where work_item_id = p_work_item_id
    and pauta_id = p_pauta_id;

  update public.work_items
  set
    pauta_id = null,
    pauta_card_id = null,
    is_pauta_card = false,
    board_id = null,
    board_column_id = null,
    destino = 'avulsa',
    updated_at = now()
  where id = p_work_item_id;

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    p_work_item_id,
    v_actor,
    'removed_from_pauta',
    v_old_values::text,
    jsonb_build_object(
      'pauta_id', null,
      'pauta_card_id', null,
      'board_id', null,
      'board_column_id', null,
      'destino', 'avulsa'
    )::text
  );

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'demand_detached',
    'work_item',
    p_work_item_id,
    v_old_values,
    jsonb_build_object(
      'preserved_as_extra', true,
      'destino', 'avulsa'
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'work_item_id', p_work_item_id,
    'preserved_as_extra', true
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_team_members_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_client_from_pauta(p_pauta_id uuid, p_client_id uuid, p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_member public.pauta_members%rowtype;
  v_client_name text;
  v_item record;
  v_detached integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'RETIRAR CLIENTE' then
    raise exception
      'Confirmação inválida. Digite RETIRAR CLIENTE.';
  end if;

  if p_client_id is null then
    raise exception 'Cliente obrigatório.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in (
    'draft',
    'open'
  ) then
    raise exception
      'Somente Pautas abertas ou em rascunho podem retirar clientes.';
  end if;

  select name
  into v_client_name
  from public.clients
  where id = p_client_id;

  if not found then
    raise exception 'Cliente não encontrado.';
  end if;

  select *
  into v_member
  from public.pauta_members
  where pauta_id = p_pauta_id
    and client_id = p_client_id
    and membership_status = 'active'
  order by added_at desc
  limit 1
  for update;

  if not found then
    raise exception
      'O cliente não possui participação ativa nesta Pauta.';
  end if;

  update public.calendar_events as event
  set
    pauta_id = null,
    updated_at = now()
  where event.pauta_id = p_pauta_id
    and (
      event.client_id = p_client_id
      or event.work_item_id in (
        select item.id
        from public.work_items as item
        where item.pauta_id = p_pauta_id
          and (
            item.client_id = p_client_id
            or item.pauta_card_id = v_member.main_work_item_id
            or item.id = v_member.main_work_item_id
          )
      )
    );

  for v_item in
    select
      item.id,
      item.is_pauta_card,
      item.pauta_card_id,
      item.board_id,
      item.board_column_id,
      item.destino
    from public.work_items as item
    where item.pauta_id = p_pauta_id
      and (
        item.client_id = p_client_id
        or item.pauta_card_id = v_member.main_work_item_id
        or item.id = v_member.main_work_item_id
      )
    for update
  loop
    update public.work_items
    set
      pauta_id = null,
      pauta_card_id = null,
      is_pauta_card = false,
      board_id = null,
      board_column_id = null,
      destino = 'avulsa',
      updated_at = now()
    where id = v_item.id;

    insert into public.work_item_history (
      work_item_id,
      actor_id,
      field_changed,
      old_value,
      new_value
    )
    values (
      v_item.id,
      v_actor,
      case
        when v_item.is_pauta_card
          then 'client_removed_from_pauta'
        else 'removed_from_pauta'
      end,
      jsonb_build_object(
        'pauta_id', p_pauta_id,
        'is_pauta_card', v_item.is_pauta_card,
        'pauta_card_id', v_item.pauta_card_id,
        'board_id', v_item.board_id,
        'board_column_id', v_item.board_column_id,
        'destino', v_item.destino
      )::text,
      jsonb_build_object(
        'pauta_id', null,
        'is_pauta_card', false,
        'pauta_card_id', null,
        'board_id', null,
        'board_column_id', null,
        'destino', 'avulsa'
      )::text
    );

    v_detached := v_detached + 1;
  end loop;

  update public.pauta_members
  set
    membership_status = 'removed',
    removed_by = v_actor,
    removed_at = now(),
    metadata =
      coalesce(metadata, '{}'::jsonb)
      ||
      jsonb_build_object(
        'items_preserved_as_extra',
        v_detached,
        'removed_from_pauta_at',
        now()
      )
  where id = v_member.id;

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'client_removed',
    'client',
    p_client_id,
    jsonb_build_object(
      'member_id', v_member.id,
      'main_work_item_id', v_member.main_work_item_id,
      'client_name', v_client_name
    ),
    jsonb_build_object(
      'membership_status', 'removed',
      'items_preserved_as_extra', v_detached
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'client_id', p_client_id,
    'member_id', v_member.id,
    'items_preserved_as_extra', v_detached
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.v8_sync_assignment_from_work_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_old_custom boolean := false;
  v_new_custom boolean := false;
  v_new_status text;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  v_actor := coalesce(
    auth.uid(),
    new.created_by,
    new.responsible_id
  );

  if tg_op = 'UPDATE' and old.board_id is not null then
    select exists(
      select 1
      from public.boards
      where id = old.board_id
        and board_kind = 'custom'
    )
    into v_old_custom;
  end if;

  if new.board_id is not null then
    select exists(
      select 1
      from public.boards
      where id = new.board_id
        and board_kind = 'custom'
        and status = 'active'
    )
    into v_new_custom;
  end if;

  if new.status in ('archived', 'cancelled')
     or (
       tg_op = 'UPDATE'
       and old.pauta_id is not null
       and new.pauta_id is null
     )
  then
    update public.work_item_board_assignments
    set
      assignment_status = 'removed',
      removed_at = now(),
      removed_by = v_actor,
      updated_at = now(),
      metadata =
        metadata ||
        jsonb_build_object(
          'removed_by_work_item_sync', true
        )
    where work_item_id = new.id
      and assignment_status = 'active';

    return new;
  end if;

  if tg_op = 'UPDATE'
     and v_old_custom
     and (
       old.board_id is distinct from new.board_id
       or old.board_column_id is distinct from new.board_column_id
     )
  then
    update public.work_item_board_assignments
    set
      assignment_status = 'removed',
      removed_at = now(),
      removed_by = v_actor,
      updated_at = now()
    where work_item_id = new.id
      and board_id = old.board_id
      and assignment_status = 'active';
  end if;

  if v_new_custom and new.board_column_id is not null then
    select operational_status
    into v_new_status
    from public.board_columns
    where id = new.board_column_id
      and board_id = new.board_id;

    if v_new_status is not null then
      insert into public.work_item_board_assignments (
        work_item_id,
        board_id,
        board_column_id,
        operational_status,
        is_required,
        assignment_status,
        position,
        assigned_by,
        assigned_at,
        completed_by,
        completed_at,
        metadata
      )
      values (
        new.id,
        new.board_id,
        new.board_column_id,
        coalesce(v_new_status, new.status, 'not_started'),
        true,
        'active',
        extract(epoch from now())::bigint,
        v_actor,
        coalesce(new.created_at, now()),
        case
          when public.v8_assignment_is_complete(
            coalesce(v_new_status, new.status)
          )
            then new.completed_by
          else null
        end,
        case
          when public.v8_assignment_is_complete(
            coalesce(v_new_status, new.status)
          )
            then coalesce(new.completed_at, now())
          else null
        end,
        jsonb_build_object(
          'source', 'legacy_dual_write'
        )
      )
      on conflict (work_item_id, board_id)
      where assignment_status = 'active'
      do update set
        board_column_id = excluded.board_column_id,
        operational_status = excluded.operational_status,
        completed_by = excluded.completed_by,
        completed_at = excluded.completed_at,
        updated_at = now();
    end if;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.v8_log_assignment_event(p_assignment_id uuid, p_work_item_id uuid, p_pauta_id uuid, p_board_id uuid, p_board_column_id uuid, p_actor_id uuid, p_action text, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_event_id uuid;
begin
  insert into public.work_item_board_assignment_events (
    assignment_id,
    work_item_id,
    pauta_id,
    board_id,
    board_column_id,
    actor_id,
    action,
    old_values,
    new_values,
    metadata
  )
  values (
    p_assignment_id,
    p_work_item_id,
    p_pauta_id,
    p_board_id,
    p_board_column_id,
    p_actor_id,
    trim(p_action),
    coalesce(p_old_values, '{}'::jsonb),
    coalesce(p_new_values, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id
  into v_event_id;

  return v_event_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_board_preserve_demands(p_board_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_board public.boards%rowtype;
  v_demands_preserved integer := 0;
  v_assignments_removed integer := 0;
begin
  if not public.app_has_total_access() then
    raise exception
      'Acesso Total é obrigatório para excluir Quadros.';
  end if;

  v_actor := public.pauta_current_active_actor();

  select *
  into v_board
  from public.boards
  where id = p_board_id
  for update;

  if not found then
    raise exception 'Quadro não encontrado.';
  end if;

  if v_board.board_kind = 'pauta' then
    raise exception
      'A estrutura de Pautas não pode ser excluída.';
  end if;

  update public.work_item_board_assignments
  set
    assignment_status = 'removed',
    removed_at = now(),
    removed_by = v_actor,
    updated_at = now(),
    metadata =
      metadata ||
      jsonb_build_object(
        'board_archived', true
      )
  where board_id = p_board_id
    and assignment_status = 'active';

  get diagnostics v_assignments_removed = row_count;

  update public.work_items
  set
    board_id = null,
    board_column_id = null,
    updated_at = now()
  where board_id = p_board_id;

  get diagnostics v_demands_preserved = row_count;

  update public.boards
  set
    status = 'archived',
    updated_at = now()
  where id = p_board_id;

  return jsonb_build_object(
    'success', true,
    'board', v_board.name,
    'board_archived', true,
    'demands_preserved', v_demands_preserved,
    'assignments_removed', v_assignments_removed
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_work_item_global_status(p_work_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_item public.work_items%rowtype;
  v_active_count integer := 0;
  v_required_count integer := 0;
  v_all_complete boolean := false;
  v_next_status text := 'not_started';
  v_completed_at timestamptz;
  v_completed_by uuid;
  v_single_board_id uuid;
  v_single_column_id uuid;
begin
  select *
  into v_item
  from public.work_items
  where id = p_work_item_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'WORK_ITEM_NOT_FOUND'
    );
  end if;

  select
    count(*),
    count(*) filter (where is_required)
  into
    v_active_count,
    v_required_count
  from public.work_item_board_assignments
  where work_item_id = p_work_item_id
    and assignment_status = 'active';

  if v_active_count = 0 then
    return jsonb_build_object(
      'success', true,
      'work_item_id', p_work_item_id,
      'assignments', 0,
      'status', v_item.status
    );
  end if;

  with effective as (
    select *
    from public.work_item_board_assignments
    where work_item_id = p_work_item_id
      and assignment_status = 'active'
      and (
        v_required_count = 0
        or is_required = true
      )
  )
  select
    bool_and(public.v8_assignment_is_complete(operational_status)),
    max(completed_at),
    (
      array_agg(
        completed_by
        order by completed_at desc nulls last
      )
    )[1]
  into
    v_all_complete,
    v_completed_at,
    v_completed_by
  from effective;

  if coalesce(v_all_complete, false) then
    v_next_status := 'done';
  else
    with effective as (
      select *
      from public.work_item_board_assignments
      where work_item_id = p_work_item_id
        and assignment_status = 'active'
        and (
          v_required_count = 0
          or is_required = true
        )
    )
    select operational_status
    into v_next_status
    from effective
    where not public.v8_assignment_is_complete(operational_status)
    order by
      case operational_status
        when 'blocked' then 1
        when 'waiting' then 2
        when 'awaiting_approval' then 3
        when 'in_review' then 4
        when 'in_progress' then 5
        when 'scheduled' then 6
        when 'not_started' then 7
        else 8
      end,
      updated_at desc
    limit 1;

    v_next_status := coalesce(v_next_status, 'not_started');
    v_completed_at := null;
    v_completed_by := null;
  end if;

  if v_item.pauta_id is not null then
    select pauta_row.board_id
    into v_single_board_id
    from public.pautas pauta_row
    where pauta_row.id = v_item.pauta_id;

    v_single_column_id := v_item.board_column_id;
  elsif v_active_count = 1 then
    select board_id, board_column_id
    into v_single_board_id, v_single_column_id
    from public.work_item_board_assignments
    where work_item_id = p_work_item_id
      and assignment_status = 'active'
    limit 1;
  else
    v_single_board_id := null;
    v_single_column_id := null;
  end if;

  update public.work_items
  set
    status = v_next_status,
    completed_at =
      case
        when v_next_status = 'done'
          then coalesce(v_completed_at, now())
        else null
      end,
    completed_by =
      case
        when v_next_status = 'done'
          then v_completed_by
        else null
      end,
    closed_at =
      case
        when v_next_status = 'done'
          then coalesce(v_completed_at, now())
        else null
      end,
    board_id = v_single_board_id,
    board_column_id = v_single_column_id,
    updated_at = now()
  where id = p_work_item_id;

  return jsonb_build_object(
    'success', true,
    'work_item_id', p_work_item_id,
    'assignments', v_active_count,
    'required_assignments', v_required_count,
    'status', v_next_status
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.seed_board_default_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.board_columns (
    board_id,
    name,
    color,
    operational_status,
    position
  )
  VALUES
    (NEW.id, 'A fazer', '#64748B', 'not_started', 0),
    (NEW.id, 'Em andamento', '#2563EB', 'in_progress', 1),
    (NEW.id, 'Aguardando', '#CA8A04', 'waiting', 2),
    (NEW.id, 'Em revisão', '#7C3AED', 'in_review', 3),
    (NEW.id, 'Concluído', '#16A34A', 'done', 4)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.comercial_lembrete_marcar(p_reuniao uuid, p_tipo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_tipo = '24h' then
    update comercial_reunioes set lembrete_24h_em = now(), updated_at = now() where id = p_reuniao;
  elsif p_tipo = '2h' then
    update comercial_reunioes set lembrete_2h_em = now(), updated_at = now() where id = p_reuniao;
  else
    return jsonb_build_object('ok', false, 'erro', 'tipo deve ser 24h ou 2h');
  end if;
  return jsonb_build_object('ok', found);
end $function$
;

CREATE OR REPLACE FUNCTION public.delete_board_column_move_cards(p_column_id uuid, p_target_column_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_board_id uuid;
  v_column_name text;
  v_target_board_id uuid;
  v_target_status text;
  v_columns_count integer;
  v_legacy_cards_count integer;
  v_assignments_count integer;
  v_cards_moved integer := 0;
  v_assignments_moved integer := 0;
begin
  if not public.app_has_total_access() then
    raise exception
      'Acesso Total é obrigatório para excluir colunas.';
  end if;

  select board_id, name
  into v_board_id, v_column_name
  from public.board_columns
  where id = p_column_id
  for update;

  if v_board_id is null then
    raise exception 'Coluna não encontrada.';
  end if;

  select count(*)
  into v_columns_count
  from public.board_columns
  where board_id = v_board_id;

  if v_columns_count <= 1 then
    raise exception
      'Não é possível excluir a última coluna do Quadro.';
  end if;

  select count(*)
  into v_legacy_cards_count
  from public.work_items
  where board_column_id = p_column_id
    and status not in ('archived', 'cancelled');

  select count(*)
  into v_assignments_count
  from public.work_item_board_assignments
  where board_column_id = p_column_id
    and assignment_status = 'active';

  if v_legacy_cards_count > 0 or v_assignments_count > 0 then
    if p_target_column_id is null then
      raise exception
        'Escolha uma coluna de destino para os cards existentes.';
    end if;

    select board_id, operational_status
    into v_target_board_id, v_target_status
    from public.board_columns
    where id = p_target_column_id
    for update;

    if v_target_board_id is null
       or v_target_board_id <> v_board_id
       or p_target_column_id = p_column_id
    then
      raise exception
        'A coluna de destino deve pertencer ao mesmo Quadro.';
    end if;

    update public.work_item_board_assignments
    set
      board_column_id = p_target_column_id,
      operational_status = v_target_status,
      completed_at =
        case
          when public.v8_assignment_is_complete(v_target_status)
            then coalesce(completed_at, now())
          else null
        end,
      completed_by =
        case
          when public.v8_assignment_is_complete(v_target_status)
            then coalesce(auth.uid(), completed_by)
          else null
        end,
      updated_at = now()
    where board_column_id = p_column_id
      and assignment_status = 'active';

    get diagnostics v_assignments_moved = row_count;

    update public.work_items
    set
      board_column_id = p_target_column_id,
      board_id = v_board_id,
      status = v_target_status,
      updated_at = now()
    where board_column_id = p_column_id;

    get diagnostics v_cards_moved = row_count;
  end if;

  delete from public.board_columns
  where id = p_column_id;

  with ordered as (
    select
      id,
      row_number() over (
        order by position, created_at, id
      ) - 1 as next_position
    from public.board_columns
    where board_id = v_board_id
  )
  update public.board_columns column_row
  set
    position = ordered.next_position,
    updated_at = now()
  from ordered
  where column_row.id = ordered.id;

  return jsonb_build_object(
    'success', true,
    'column', v_column_name,
    'cards_moved', v_cards_moved,
    'assignments_moved', v_assignments_moved
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.comercial_lembretes_pendentes()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with cfg as (select coalesce((select value #>> '{}' from comercial_config where key = 'responsavel'), 'Willian') as resp),
  base as (
    select r.id, r.inicio, r.meet_link, r.created_at, r.lembrete_24h_em, r.lembrete_2h_em,
           l.session_id, regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g') as telefone,
           nullif(split_part(trim(coalesce(l.nome, '')), ' ', 1), '') as primeiro_nome,
           case when (r.inicio at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date then 'hoje' else 'amanhã' end as quando,
           extract(hour from r.inicio at time zone 'America/Sao_Paulo')::int as hora,
           extract(minute from r.inicio at time zone 'America/Sao_Paulo')::int as minuto
    from comercial_reunioes r
    join comercial_leads l on l.id = r.lead_id
    where r.status in ('agendada', 'confirmada', 'reagendada')
      and l.status <> 'humano'
      and l.session_id like 'wa\_%'
      and r.inicio > now()
  ),
  pend as (
    select b.*, '24h'::text as tipo from base b
    where b.lembrete_24h_em is null
      and now() >= b.inicio - interval '24 hours' and now() < b.inicio - interval '4 hours'
      and b.created_at < b.inicio - interval '20 hours'
    union all
    select b.*, '2h'::text from base b
    where b.lembrete_2h_em is null
      and now() >= b.inicio - interval '2 hours' and now() < b.inicio - interval '20 minutes'
      and b.created_at < b.inicio - interval '3 hours'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'reuniao_id', p.id,
    'tipo', p.tipo,
    'session_id', p.session_id,
    'telefone', p.telefone,
    'texto', case p.tipo
      when '24h' then
        'Oi' || coalesce(', ' || p.primeiro_nome, '') || '! Passando para lembrar da nossa conversa ' || p.quando || ', ' || comercial_rotulo(p.inicio)
        || ', com o ' || (select resp from cfg) || ', nosso responsável comercial.'
        || coalesce(' O link é ' || p.meet_link, '')
        || ' 😊 Se precisar mudar o horário, é só me avisar por aqui.'
      else
        'Oi' || coalesce(', ' || p.primeiro_nome, '') || '! Daqui a pouco, às ' || p.hora || 'h' || case when p.minuto > 0 then lpad(p.minuto::text, 2, '0') else '' end
        || ', é a nossa conversa com o ' || (select resp from cfg) || '.'
        || coalesce(' O link é ' || p.meet_link, '')
        || ' Até já!'
    end
  ) order by p.inicio), '[]'::jsonb)
  from pend p
  where length(p.telefone) between 10 and 13;
$function$
;

CREATE OR REPLACE FUNCTION public.seed_project_step_statuses_for_work_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.destino IN ('projeto', 'ambos')
    AND NOT EXISTS (
      SELECT 1
      FROM public.project_step_statuses existing
      WHERE existing.work_item_id = NEW.id
        AND existing.is_archived = false
    )
  THEN
    INSERT INTO public.project_step_statuses (
      work_item_id,
      name,
      color,
      behavior,
      position
    )
    VALUES
      (
        NEW.id,
        'A fazer',
        '#64748B',
        'pending',
        0
      ),
      (
        NEW.id,
        'Em andamento',
        '#7C3AED',
        'active',
        1
      ),
      (
        NEW.id,
        'Aguardando',
        '#D97706',
        'blocked',
        2
      ),
      (
        NEW.id,
        'Concluído',
        '#16A34A',
        'done',
        3
      )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_project_step_statuses_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.comercial_resumo_semana(p_since date DEFAULT NULL::date, p_until date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
per as (
  select coalesce(p_since, (select d - (extract(isodow from d)::int - 1) - 7 from hoje)) as s,
         coalesce(p_until, (select d - (extract(isodow from d)::int - 1) - 1 from hoje)) as u
),
leads as (
  select l.*, (l.created_at at time zone 'America/Sao_Paulo')::date as dia,
         exists (select 1 from public.comercial_reunioes r where r.lead_id = l.id and r.status <> 'cancelada') as tem_r1
  from public.comercial_leads l, per
  where (l.created_at at time zone 'America/Sao_Paulo')::date between per.s and per.u
    and coalesce(l.origem, '') <> 'teste'
    and l.session_id not ilike 'teste%'
),
cls as (
  select l.*,
    case when l.tem_r1 then 'r1'
         when l.status = 'desqualificado' or l.motivo_fora is not null then 'fora'
         when l.formulario_enviado_em is not null then 'morno'
         when l.status = 'humano' then 'humano'
         else 'em_conversa' end as resultado
  from leads l
),
reun as (
  select r.inicio, r.status, r.meet_link, l.nome, l.empresa
  from public.comercial_reunioes r
  join public.comercial_leads l on l.id = r.lead_id
  where l.session_id not ilike 'teste%' and coalesce(l.origem, '') <> 'teste'
)
select jsonb_build_object(
  'periodo', (select jsonb_build_object('since', s, 'until', u) from per),
  'totais', jsonb_build_object(
    'leads', (select count(*) from cls),
    'r1', (select count(*) from cls where resultado = 'r1'),
    'morno', (select count(*) from cls where resultado = 'morno'),
    'fora', (select count(*) from cls where resultado = 'fora'),
    'humano', (select count(*) from cls where resultado = 'humano'),
    'em_conversa', (select count(*) from cls where resultado = 'em_conversa'),
    'anuncio', (select count(*) from cls where origem = 'anuncio'),
    'organico', (select count(*) from cls where origem = 'organico'),
    'formulario', (select count(*) from cls where origem = 'formulario')
  ),
  'campanhas', coalesce((
    select jsonb_agg(jsonb_build_object('campanha', c, 'leads', n, 'r1', r1) order by n desc)
    from (select coalesce(nullif(campanha, ''), '(sem nome)') as c, count(*) as n, count(*) filter (where resultado = 'r1') as r1
          from cls where origem = 'anuncio' group by 1) x), '[]'::jsonb),
  'reunioes_semana', coalesce((
    select jsonb_agg(jsonb_build_object('inicio', inicio, 'status', status, 'nome', nome, 'empresa', empresa) order by inicio)
    from reun, per where (inicio at time zone 'America/Sao_Paulo')::date between per.s and per.u), '[]'::jsonb),
  'proximas_reunioes', coalesce((
    select jsonb_agg(jsonb_build_object('inicio', inicio, 'status', status, 'nome', nome, 'empresa', empresa, 'meet', meet_link) order by inicio)
    from reun where inicio > now() and status in ('agendada', 'confirmada', 'reagendada')), '[]'::jsonb),
  'leads', coalesce((
    select jsonb_agg(jsonb_build_object('dia', dia, 'nome', nome, 'empresa', empresa, 'segmento', segmento, 'cidade', cidade,
      'resultado', resultado, 'temperatura', temperatura, 'score', score, 'origem', origem, 'campanha', campanha,
      'motivo_fora', motivo_fora, 'telefone', telefone) order by created_at)
    from cls), '[]'::jsonb)
);
$function$
;

CREATE OR REPLACE FUNCTION public.touch_pautas_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_cycle_schedule_requirement_from_calendar_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_old_requirement_type text;
  v_new_requirement_type text;

  v_existing_event_id uuid;
  v_actor uuid;
begin
  -- -------------------------------------------------------
  -- Exclusão do evento
  -- -------------------------------------------------------

  if tg_op = 'DELETE' then
    v_old_requirement_type :=
      case
        when old.type = 'reu_a'
          then 'alignment_meeting'

        when old.type in (
          'cap_e',
          'cap_s'
        )
          then 'capture'

        else null
      end;

    if
      old.work_item_id is not null
      and v_old_requirement_type is not null
    then
      update
        public.work_item_schedule_requirements
      set
        status = 'pending',
        calendar_event_id = null,
        scheduled_at = null,
        confirmed_at = null,
        completed_at = null,
        updated_at = now()
      where
        work_item_id = old.work_item_id
        and requirement_type =
          v_old_requirement_type
        and calendar_event_id = old.id;
    end if;

    return old;
  end if;

  -- -------------------------------------------------------
  -- Inserção ou atualização do evento
  -- -------------------------------------------------------

  v_new_requirement_type :=
    case
      when new.type = 'reu_a'
        then 'alignment_meeting'

      when new.type in (
        'cap_e',
        'cap_s'
      )
        then 'capture'

      else null
    end;

  if tg_op = 'UPDATE' then
    v_old_requirement_type :=
      case
        when old.type = 'reu_a'
          then 'alignment_meeting'

        when old.type in (
          'cap_e',
          'cap_s'
        )
          then 'capture'

        else null
      end;

    if
      old.work_item_id is not null
      and v_old_requirement_type is not null
      and (
        new.work_item_id is distinct from
          old.work_item_id

        or v_new_requirement_type is distinct from
          v_old_requirement_type
      )
    then
      update
        public.work_item_schedule_requirements
      set
        status = 'pending',
        calendar_event_id = null,
        scheduled_at = null,
        confirmed_at = null,
        completed_at = null,
        updated_at = now()
      where
        work_item_id = old.work_item_id
        and requirement_type =
          v_old_requirement_type
        and calendar_event_id = old.id;
    end if;
  end if;

  -- Tipos que não representam reunião ou captação
  -- não alteram requisitos operacionais.
  if
    new.work_item_id is null
    or v_new_requirement_type is null
  then
    return new;
  end if;

  select
    calendar_event_id
  into
    v_existing_event_id
  from
    public.work_item_schedule_requirements
  where
    work_item_id = new.work_item_id
    and requirement_type =
      v_new_requirement_type
  for update;

  if
    found
    and v_existing_event_id is not null
    and v_existing_event_id <> new.id
  then
    raise exception
      'Esta demanda já possui uma agenda principal de % vinculada.',
      case
        when v_new_requirement_type =
          'alignment_meeting'
          then 'reunião'

        else 'captação'
      end;
  end if;

  v_actor :=
    coalesce(
      new.created_by,
      auth.uid()
    );

  insert into
    public.work_item_schedule_requirements (
      work_item_id,
      requirement_type,
      status,
      calendar_event_id,
      calendar_type,
      created_by,
      scheduled_at,
      confirmed_at,
      completed_at,
      created_at,
      updated_at
    )
  values (
    new.work_item_id,
    v_new_requirement_type,

    case
      when coalesce(
        new.confirmed,
        false
      )
        then 'confirmed'

      else 'scheduled'
    end,

    new.id,
    new.type,
    v_actor,
    new.starts_at,

    case
      when coalesce(
        new.confirmed,
        false
      )
        then now()

      else null
    end,

    null,
    now(),
    now()
  )
  on conflict (
    work_item_id,
    requirement_type
  )
  do update
  set
    status =
      case
        when coalesce(
          new.confirmed,
          false
        )
          then 'confirmed'

        else 'scheduled'
      end,

    calendar_event_id =
      new.id,

    calendar_type =
      new.type,

    scheduled_at =
      new.starts_at,

    confirmed_at =
      case
        when coalesce(
          new.confirmed,
          false
        )
          then coalesce(
            public
              .work_item_schedule_requirements
              .confirmed_at,
            now()
          )

        else null
      end,

    completed_at =
      null,

    updated_at =
      now();

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.traffic_brl(v numeric)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select translate(to_char(round(coalesce(v, 0), 2), 'FM999,999,990.00'), ',.', '.,')
$function$
;

CREATE OR REPLACE FUNCTION public.traffic_indicador(ind text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case ind
    when 'actions:onsite_conversion.messaging_conversation_started_7d' then 'conversas'
    when 'profile_visit_view' then 'visitas ao perfil'
    when 'actions:offsite_conversion.fb_pixel_initiate_checkout' then 'checkouts'
    when 'actions:offsite_conversion.fb_pixel_purchase' then 'compras'
    when 'actions:lead' then 'leads'
    when 'actions:onsite_conversion.lead_grouped' then 'leads'
    when 'actions:link_click' then 'cliques no link'
    when 'video_thruplay_watched_actions' then 'ThruPlays'
    when 'reach' then 'alcance'
    else 'resultados' end
$function$
;

CREATE OR REPLACE FUNCTION public.traffic_alertas_base(p_ref date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d date := coalesce(p_ref, (now() at time zone 'America/Sao_Paulo')::date - 1);
  r record;
  c record;
  out jsonb := '[]'::jsonb;
  contas jsonb := '[]'::jsonb;
  media numeric;
  restante numeric;
  saldo numeric;
  parada boolean;
  ind text;
  r_rec numeric; s_rec numeric; r_base numeric; s_base numeric; cpr_base numeric; cpr_rec numeric;
  n int; nomes text;
begin
  for r in
    select a.id, a.name, a.account_status, a.spend_cap, a.amount_spent_total, a.billing_type, a.payment_method_label,
           a.last_synced_at,
           coalesce(tc.display_name, regexp_replace(a.name, '^CA\s*-\s*', '')) as cliente,
           (select coalesce(sum(i.spend), 0) from public.meta_insights_daily i
             where i.ad_account_id = a.id and i.level = 'account' and i.date_start between d - 6 and d) as gasto7,
           (select coalesce(sum(i.spend), 0) from public.meta_insights_daily i
             where i.ad_account_id = a.id and i.level = 'account' and i.date_start = d) as gasto_ontem,
           (select max(i.date_start) from public.meta_insights_daily i
             where i.ad_account_id = a.id and i.level = 'account' and i.spend > 0 and i.date_start <= d) as ult_gasto,
           (select count(*) from public.meta_campaigns cp
             where cp.ad_account_id = a.id and cp.effective_status = 'ACTIVE') as camp_ativas
      from public.meta_ad_accounts a
      left join public.traffic_report_clients tc on tc.ad_account_id = a.id
     where a.is_selected
     order by 9
  loop
    parada := false;
    media := round(r.gasto7 / 7.0, 2);
    contas := contas || jsonb_build_object('cliente', r.cliente, 'gasto_ontem', r.gasto_ontem, 'media_dia', media,
                                           'camp_ativas', r.camp_ativas, 'ult_gasto', r.ult_gasto, 'sync', r.last_synced_at);

    -- 1. status da conta
    if r.account_status is not null and r.account_status <> 1 then
      out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'critico', 'tipo', 'status_conta', 'texto',
        case r.account_status
          when 2 then 'Conta desativada pela Meta.'
          when 3 then 'Conta com pagamento pendente. A Meta para os anúncios até acertar.'
          when 7 then 'Conta em análise de risco pela Meta.'
          when 8 then 'Conta com acerto de pagamento pendente.'
          when 9 then 'Conta em período de carência por pagamento. Acertar antes de parar.'
          when 100 then 'Conta em encerramento.'
          when 101 then 'Conta encerrada.'
          else 'Conta com status ' || r.account_status || ' na Meta.' end);
      parada := true;
    end if;

    -- 2. limite de gasto da conta
    if coalesce(r.spend_cap, 0) > 0 then
      restante := r.spend_cap - coalesce(r.amount_spent_total, 0);
      if restante < 1 and r.camp_ativas > 0 then
        if r.ult_gasto is not null and r.ult_gasto >= d - 6 then
          out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'critico', 'tipo', 'limite_atingido', 'texto',
            format('Limite de gasto da conta atingido (R$ %s), último gasto em %s. %s campanha(s) ativa(s) sem entregar até aumentar o limite.',
                   public.traffic_brl(r.spend_cap), to_char(r.ult_gasto, 'DD/MM'), r.camp_ativas));
        else
          out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'info', 'tipo', 'parada_antiga', 'texto',
            case when r.ult_gasto is null
              then format('Nunca gastou: limite de gasto de R$ %s já atingido, %s campanha(s) ativa(s).', public.traffic_brl(r.spend_cap), r.camp_ativas)
              else format('Parada desde %s: limite de gasto de R$ %s atingido, %s campanha(s) ativa(s).', to_char(r.ult_gasto, 'DD/MM'), public.traffic_brl(r.spend_cap), r.camp_ativas) end);
        end if;
        parada := true;
      elsif media > 0 and restante < media * 3 then
        out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'atencao', 'tipo', 'limite_perto', 'texto',
          format('Limite de gasto acaba em cerca de %s dia(s): faltam R$ %s de R$ %s, média de R$ %s por dia.',
                 greatest(1, floor(restante / media))::int, public.traffic_brl(restante), public.traffic_brl(r.spend_cap), public.traffic_brl(media)));
      end if;
    end if;

    -- 3. saldo pré-pago
    if r.billing_type = 'PRE_PAGO' and coalesce(r.payment_method_label, '') ~ 'R\$\s*[0-9.]+,[0-9]{2}' then
      saldo := replace(replace(substring(r.payment_method_label from 'R\$\s*([0-9.]+,[0-9]{2})'), '.', ''), ',', '.')::numeric;
      if saldo < 1 and r.camp_ativas > 0 then
        out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'critico', 'tipo', 'saldo_zerado', 'texto',
          'Saldo pré-pago zerado. Anúncios parados até adicionar saldo.');
        parada := true;
      elsif media > 0 and saldo < media * 3 then
        out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'atencao', 'tipo', 'saldo_baixo', 'texto',
          format('Saldo pré-pago acaba em cerca de %s dia(s): R$ %s, média de R$ %s por dia.',
                 greatest(1, floor(saldo / media))::int, public.traffic_brl(saldo), public.traffic_brl(media)));
      end if;
    end if;

    if not parada then
      -- 4 e 5. campanhas ativas: entrega e custo por resultado
      for c in
        select cp.name, cp.meta_campaign_id, cp.meta_created_time, cp.start_time,
               (select coalesce(sum(i.spend), 0) from public.meta_insights_daily i
                 where i.ad_account_id = r.id and i.level = 'campaign' and i.entity_id = cp.meta_campaign_id and i.date_start = d) as ontem,
               (select coalesce(sum(i.spend), 0) from public.meta_insights_daily i
                 where i.ad_account_id = r.id and i.level = 'campaign' and i.entity_id = cp.meta_campaign_id and i.date_start between d - 7 and d - 1) as ant7,
               (select coalesce(sum(i.spend), 0) from public.meta_insights_daily i
                 where i.ad_account_id = r.id and i.level = 'campaign' and i.entity_id = cp.meta_campaign_id and i.date_start between d - 6 and d) as ult7
          from public.meta_campaigns cp
         where cp.ad_account_id = r.id and cp.effective_status = 'ACTIVE'
         order by cp.name
      loop
        if c.ant7 / 7.0 >= 5 and c.ontem < (c.ant7 / 7.0) * 0.3 then
          out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'atencao', 'tipo', 'entrega_caiu', 'texto',
            format('%s: gastou R$ %s ontem, média de R$ %s por dia na semana anterior. Ver entrega.',
                   c.name, public.traffic_brl(c.ontem), public.traffic_brl(c.ant7 / 7.0)));
        elsif c.ult7 = 0 and coalesce(c.start_time, c.meta_created_time) < (d - 3)::timestamptz then
          out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'atencao', 'tipo', 'sem_entrega', 'texto',
            format('%s: ativa e sem gastar nos últimos 7 dias.', c.name));
        end if;

        ind := null;
        select i.result_indicator into ind
          from public.meta_insights_daily i
         where i.ad_account_id = r.id and i.level = 'campaign' and i.entity_id = c.meta_campaign_id
           and i.date_start between d - 9 and d and i.result_indicator is not null and i.result_indicator <> 'mixed'
         group by 1 order by sum(coalesce(i.result_count, 0)) desc limit 1;

        if ind is not null then
          select coalesce(sum(case when i.date_start >= d - 2 then i.result_count end), 0),
                 coalesce(sum(case when i.date_start >= d - 2 then i.spend end), 0),
                 coalesce(sum(case when i.date_start < d - 2 then i.result_count end), 0),
                 coalesce(sum(case when i.date_start < d - 2 then i.spend end), 0)
            into r_rec, s_rec, r_base, s_base
            from public.meta_insights_daily i
           where i.ad_account_id = r.id and i.level = 'campaign' and i.entity_id = c.meta_campaign_id
             and i.date_start between d - 9 and d
             and (i.result_indicator = ind or coalesce(i.result_count, 0) = 0);
          if r_base >= 5 and s_rec >= 20 then
            cpr_base := s_base / r_base;
            if r_rec > 0 then
              cpr_rec := s_rec / r_rec;
              if cpr_rec >= cpr_base * 1.5 then
                out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'atencao', 'tipo', 'custo_subiu', 'texto',
                  format('%s: custo por resultado (%s) subiu %s%%. R$ %s nos últimos 3 dias contra R$ %s nos 7 dias antes.',
                         c.name, public.traffic_indicador(ind), round((cpr_rec / cpr_base - 1) * 100)::int,
                         public.traffic_brl(cpr_rec), public.traffic_brl(cpr_base)));
              end if;
            elsif s_rec >= cpr_base * 2 then
              out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'atencao', 'tipo', 'sem_resultado', 'texto',
                format('%s: R$ %s em 3 dias sem resultado (%s). Antes custava R$ %s cada.',
                       c.name, public.traffic_brl(s_rec), public.traffic_indicador(ind), public.traffic_brl(cpr_base)));
            end if;
          end if;
        end if;
      end loop;

      -- 6. anúncios reprovados ou com problema em campanha e conjunto ativos
      select count(*),
             string_agg(x.name, ', ' order by x.name) filter (where x.rn <= 5)
        into n, nomes
        from (select ad.name, row_number() over (order by ad.name) as rn
                from public.meta_ads ad
                join public.meta_campaigns cp on cp.id = ad.campaign_id
                join public.meta_adsets s on s.id = ad.adset_id
               where ad.ad_account_id = r.id and ad.effective_status in ('DISAPPROVED', 'WITH_ISSUES')
                 and cp.effective_status = 'ACTIVE' and s.effective_status = 'ACTIVE') x;
      if n > 0 then
        out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'atencao', 'tipo', 'anuncio_problema', 'texto',
          format('%s anúncio(s) reprovado(s) ou com problema em campanha ativa: %s%s.', n, nomes, case when n > 5 then ' e outros' else '' end));
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'ref', d,
    'criticos', (select count(*) from jsonb_array_elements(out) e where e->>'nivel' = 'critico'),
    'atencao', (select count(*) from jsonb_array_elements(out) e where e->>'nivel' = 'atencao'),
    'info', (select count(*) from jsonb_array_elements(out) e where e->>'nivel' = 'info'),
    'alertas', out,
    'contas', contas);
end
$function$
;

CREATE OR REPLACE FUNCTION public.meta_write_token()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select decrypted_secret from vault.decrypted_secrets where name = 'meta_write_token' limit 1; $function$
;

CREATE OR REPLACE FUNCTION public.traffic_alertas(p_ref date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d date := coalesce(p_ref, (now() at time zone 'America/Sao_Paulo')::date - 1);
  b jsonb := public.traffic_alertas_base(d);
  s jsonb := public.traffic_sugestoes(d, b);
begin
  return b || jsonb_build_object('alertas', coalesce(b->'alertas', '[]'::jsonb) || s, 'acoes', jsonb_array_length(s));
end
$function$
;

CREATE OR REPLACE FUNCTION public.traffic_sugestoes(d date, base jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with paradas as (
    select distinct e->>'cliente' as cliente
      from jsonb_array_elements(coalesce(base->'alertas', '[]'::jsonb)) e
     where e->>'tipo' in ('status_conta', 'limite_atingido', 'saldo_zerado', 'parada_antiga')
  ),
  contas as (
    select a.id, coalesce(tc.display_name, regexp_replace(a.name, '^CA\s*-\s*', '')) as cliente
      from public.meta_ad_accounts a
      left join public.traffic_report_clients tc on tc.ad_account_id = a.id
     where a.is_selected
  ),
  base_ad as (
    select i.ad_account_id, i.meta_campaign_id, i.entity_id as ad_id, i.result_indicator as ind,
           sum(i.spend) as s, sum(coalesce(i.result_count, 0)) as r
      from public.meta_insights_daily i
      join contas c on c.id = i.ad_account_id
     where i.level = 'ad' and i.date_start between d - 6 and d
     group by 1, 2, 3, 4
  ),
  camp_ind as (
    select ad_account_id, meta_campaign_id, (array_agg(ind order by rr desc))[1] as ind
      from (select ad_account_id, meta_campaign_id, ind, sum(r) as rr
              from base_ad where ind is not null and ind <> 'mixed'
             group by 1, 2, 3 having sum(r) > 0) z
     group by 1, 2
  ),
  camp as (
    select b.ad_account_id, b.meta_campaign_id, ci.ind, sum(b.s) as s,
           sum(case when b.ind = ci.ind then b.r else 0 end) as r
      from base_ad b join camp_ind ci using (ad_account_id, meta_campaign_id)
     group by 1, 2, 3
  ),
  ads as (
    select b.ad_account_id, b.ad_id, b.meta_campaign_id, sum(b.s) as s,
           sum(case when b.ind = cm.ind then b.r else 0 end) as r
      from base_ad b join camp cm using (ad_account_id, meta_campaign_id)
     group by 1, 2, 3
  ),
  cand as (
    select c.cliente, ad.name as ad_name, cp.name as camp_name, x.s, cm.ind, cm.s / nullif(cm.r, 0) as cpr,
           (select count(*) from public.meta_ads o join public.meta_adsets os on os.id = o.adset_id
             where o.campaign_id = cp.id and o.effective_status = 'ACTIVE' and os.effective_status = 'ACTIVE') as ativos
      from ads x
      join camp cm on cm.ad_account_id = x.ad_account_id and cm.meta_campaign_id = x.meta_campaign_id
      join contas c on c.id = x.ad_account_id
      join public.meta_ads ad on ad.meta_ad_id = x.ad_id and ad.effective_status = 'ACTIVE'
      join public.meta_campaigns cp on cp.id = ad.campaign_id and cp.effective_status = 'ACTIVE'
      join public.meta_adsets st on st.id = ad.adset_id and st.effective_status = 'ACTIVE'
     where x.r = 0 and cm.r > 0 and x.s >= greatest(15, 1.5 * cm.s / cm.r)
       and c.cliente not in (select cliente from paradas)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'cliente', cliente, 'nivel', 'acao',
           'tipo', case when ativos >= 2 then 'pausar_anuncio' else 'trocar_criativo' end,
           'texto', case when ativos >= 2
             then format('Pausar o anúncio %s (%s): R$ %s em 7 dias sem resultado (%s). A campanha custa R$ %s por resultado.',
                         ad_name, camp_name, public.traffic_brl(s), public.traffic_indicador(ind), public.traffic_brl(cpr))
             else format('Trocar o criativo de %s: o único anúncio ativo (%s) gastou R$ %s em 7 dias sem resultado (%s).',
                         camp_name, ad_name, public.traffic_brl(s), public.traffic_indicador(ind)) end)
         order by cliente, s desc), '[]'::jsonb)
    from cand
$function$
;

CREATE OR REPLACE FUNCTION public.touch_pauta_members_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pauta_current_active_actor()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception
      'Sessão inválida ou expirada.';
  end if;

  if not public.app_is_active_user() then
    raise exception
      'Usuário inativo ou sem autorização operacional.';
  end if;

  return v_actor;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pauta_management_actor()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
begin
  v_actor := public.pauta_current_active_actor();

  if not public.app_has_total_access() then
    raise exception
      'Somente usuários com Acesso Total podem alterar a estrutura da Pauta.';
  end if;

  return v_actor;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pauta_create_main_card_core(p_pauta_id uuid, p_client_id uuid, p_actor_id uuid, p_source text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_pauta public.pautas%rowtype;
  v_board public.boards%rowtype;
  v_alignment public.board_columns%rowtype;
  v_client public.clients%rowtype;
  v_existing_member public.pauta_members%rowtype;

  v_work_item_id uuid;
  v_existing_main_id uuid;

  v_requires_alignment boolean := false;
  v_requires_capture boolean := false;
  v_capture_type text;
  v_title text;
  v_source text := trim(coalesce(p_source, 'added'));
begin
  if p_pauta_id is null then
    raise exception 'Pauta obrigatória.';
  end if;

  if p_client_id is null then
    raise exception 'Cliente obrigatório.';
  end if;

  if p_actor_id is null then
    raise exception 'Autor obrigatório.';
  end if;

  if v_source not in (
    'opened',
    'added',
    'legacy_adopted',
    'backfill',
    'restored'
  ) then
    raise exception 'Origem de participação inválida.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in (
    'draft',
    'open'
  ) then
    raise exception
      'Somente Pautas abertas ou em rascunho podem receber clientes.';
  end if;

  select *
  into v_board
  from public.boards
  where id = v_pauta.board_id
    and status = 'active'
    and board_kind = 'pauta';

  if not found then
    raise exception
      'O Quadro operacional da Pauta está inválido ou inativo.';
  end if;

  select *
  into v_client
  from public.clients
  where id = p_client_id
    and status = 'active';

  if not found then
    raise exception
      'Cliente não encontrado ou inativo.';
  end if;

  select *
  into v_existing_member
  from public.pauta_members
  where pauta_id = p_pauta_id
    and client_id = p_client_id
    and membership_status = 'active'
  order by added_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'success', true,
      'created', false,
      'membership_created', false,
      'work_item_id', v_existing_member.main_work_item_id,
      'client_id', p_client_id,
      'reason', 'ALREADY_IN_PAUTA'
    );
  end if;

  select id
  into v_existing_main_id
  from public.work_items
  where pauta_id = p_pauta_id
    and client_id = p_client_id
    and is_pauta_card = true
  order by created_at
  limit 1
  for update;

  if found then
    insert into public.pauta_members (
      pauta_id,
      client_id,
      main_work_item_id,
      membership_status,
      source,
      added_by,
      added_at,
      metadata
    )
    values (
      p_pauta_id,
      p_client_id,
      v_existing_main_id,
      'active',
      'restored',
      p_actor_id,
      now(),
      jsonb_build_object(
        'reason',
        'existing_main_card_without_active_membership'
      )
    );

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      p_actor_id,
      'client_membership_restored',
      'client',
      p_client_id,
      '{}'::jsonb,
      jsonb_build_object(
        'main_work_item_id',
        v_existing_main_id
      ),
      '{}'::jsonb
    );

    return jsonb_build_object(
      'success', true,
      'created', false,
      'membership_created', true,
      'work_item_id', v_existing_main_id,
      'client_id', p_client_id,
      'reason', 'MEMBERSHIP_RESTORED'
    );
  end if;

  select *
  into v_alignment
  from public.board_columns
  where board_id = v_pauta.board_id
    and automation_role = 'alignment'
  order by position, created_at
  limit 1;

  if not found then
    raise exception
      'O Quadro não possui a coluna Reunião de Alinhamento configurada.';
  end if;

  v_title :=
    upper(trim(v_client.name)) ||
    ' - ' ||
    to_char(v_pauta.reference_month, 'MM/YYYY');

  insert into public.work_items (
    title,
    description,
    type,
    origin,
    destino,
    status,
    priority,
    client_id,
    client_service_id,
    responsible_id,
    board_id,
    board_column_id,
    internal_deadline,
    final_deadline,
    drive_link,
    notes,
    blocked_reason,
    created_by,
    closed_at,
    pauta_id,
    is_pauta_card,
    pauta_card_id,
    completed_at
  )
  values (
    v_title,
    null,
    'Planejamento',
    'planned',
    'quadro',
    coalesce(
      v_alignment.operational_status,
      'not_started'
    ),
    'normal',
    v_client.id,
    null,
    v_client.responsible_id,
    v_pauta.board_id,
    v_alignment.id,
    v_pauta.magic_number_date,
    v_pauta.magic_number_date,
    v_client.drive_folder_url,
    null,
    null,
    p_actor_id,
    null,
    p_pauta_id,
    true,
    null,
    null
  )
  returning id
  into v_work_item_id;

  select
    coalesce(
      bool_or(service.requires_alignment_meeting),
      false
    ),
    coalesce(
      bool_or(service.requires_capture),
      false
    ),
    case
      when count(
        distinct service.default_capture_type
      ) filter (
        where service.default_capture_type is not null
      ) = 1
      then max(
        service.default_capture_type
      ) filter (
        where service.default_capture_type is not null
      )
      else null
    end
  into
    v_requires_alignment,
    v_requires_capture,
    v_capture_type
  from public.client_services as service
  where service.client_id = v_client.id
    and service.status = 'active';

  if v_requires_alignment then
    insert into public.work_item_schedule_requirements (
      work_item_id,
      requirement_type,
      status,
      calendar_type,
      created_by
    )
    values (
      v_work_item_id,
      'alignment_meeting',
      'pending',
      'reu_a',
      p_actor_id
    )
    on conflict (
      work_item_id,
      requirement_type
    )
    do nothing;
  end if;

  if v_requires_capture then
    insert into public.work_item_schedule_requirements (
      work_item_id,
      requirement_type,
      status,
      calendar_type,
      created_by
    )
    values (
      v_work_item_id,
      'capture',
      'pending',
      v_capture_type,
      p_actor_id
    )
    on conflict (
      work_item_id,
      requirement_type
    )
    do nothing;
  end if;

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    v_work_item_id,
    p_actor_id,
    case
      when v_source = 'opened'
        then 'pauta_opened'
      else 'pauta_client_added'
    end,
    null,
    p_pauta_id::text
  );

  insert into public.pauta_members (
    pauta_id,
    client_id,
    main_work_item_id,
    membership_status,
    source,
    added_by,
    added_at,
    metadata
  )
  values (
    p_pauta_id,
    p_client_id,
    v_work_item_id,
    'active',
    v_source,
    p_actor_id,
    now(),
    jsonb_build_object(
      'main_card_created',
      true
    )
  );

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    p_actor_id,
    'client_added',
    'client',
    p_client_id,
    '{}'::jsonb,
    jsonb_build_object(
      'main_work_item_id',
      v_work_item_id,
      'source',
      v_source
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'created', true,
    'membership_created', true,
    'work_item_id', v_work_item_id,
    'client_id', p_client_id,
    'reason', 'MAIN_CARD_CREATED'
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.preview_pauta_client_additions(p_pauta_id uuid, p_client_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_clients jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
begin
  v_actor := public.pauta_current_active_actor();

  if p_pauta_id is null then
    raise exception 'Pauta obrigatória.';
  end if;

  if p_client_ids is null
     or cardinality(p_client_ids) = 0
  then
    raise exception
      'Selecione pelo menos um cliente.';
  end if;

  if cardinality(p_client_ids) > 300 then
    raise exception
      'É permitido analisar no máximo 300 clientes por operação.';
  end if;

  if exists (
    select 1
    from unnest(p_client_ids) as selected(client_id)
    where selected.client_id is null
  ) then
    raise exception
      'A seleção contém cliente inválido.';
  end if;

  if (
    select count(*)
    from unnest(p_client_ids)
  ) <> (
    select count(distinct client_id)
    from unnest(p_client_ids) as selected(client_id)
  ) then
    raise exception
      'A seleção contém clientes duplicados.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  with selected_clients as (
    select distinct selected.client_id
    from unnest(p_client_ids) as selected(client_id)
  ),
  analyzed as (
    select
      selected.client_id,
      client.name as client_name,
      client.status as client_status,

      exists (
        select 1
        from public.pauta_members as member
        where member.pauta_id = p_pauta_id
          and member.client_id = selected.client_id
          and member.membership_status = 'active'
      ) as already_in_pauta,

      (
        select count(*)
        from public.work_items as item
        where item.board_id = v_pauta.board_id
          and item.pauta_id is null
          and item.client_id = selected.client_id
          and item.is_pauta_card = false
          and item.status not in (
            'archived',
            'cancelled'
          )
      ) as legacy_count,

      (
        select count(*)
        from public.client_services as service
        where service.client_id = selected.client_id
          and service.status = 'active'
      ) as active_service_count,

      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'work_item_id', item.id,
              'title', item.title,
              'status', item.status,
              'priority', item.priority,
              'board_column_id', item.board_column_id,
              'responsible_id', item.responsible_id,
              'client_service_id', item.client_service_id,
              'internal_deadline', item.internal_deadline,
              'final_deadline', item.final_deadline,
              'created_at', item.created_at
            )
            order by item.created_at
          ),
          '[]'::jsonb
        )
        from public.work_items as item
        where item.board_id = v_pauta.board_id
          and item.pauta_id is null
          and item.client_id = selected.client_id
          and item.is_pauta_card = false
          and item.status not in (
            'archived',
            'cancelled'
          )
      ) as legacy_candidates
    from selected_clients as selected
    left join public.clients as client
      on client.id = selected.client_id
  ),
  classified as (
    select
      analyzed.*,
      case
        when client_name is null
          or client_status <> 'active'
          then 'INACTIVE_CLIENT'

        when already_in_pauta
          then 'ALREADY_IN_PAUTA'

        when legacy_count = 1
          then 'LEGACY_CARD_AVAILABLE'

        when legacy_count > 1
          then 'MULTIPLE_LEGACY_CARDS'

        when active_service_count = 0
          then 'NO_ACTIVE_SERVICE'

        else 'NO_LEGACY_CARD'
      end as classification
    from analyzed
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'client_id', client_id,
          'client_name', client_name,
          'client_status', client_status,
          'classification', classification,
          'already_in_pauta', already_in_pauta,
          'legacy_count', legacy_count,
          'legacy_candidates', legacy_candidates,
          'active_service_count', active_service_count,
          'service_warning',
            active_service_count = 0
        )
        order by client_name nulls last
      ),
      '[]'::jsonb
    ),

    jsonb_build_object(
      'total',
        count(*),

      'already_in_pauta',
        count(*) filter (
          where classification = 'ALREADY_IN_PAUTA'
        ),

      'legacy_card_available',
        count(*) filter (
          where classification = 'LEGACY_CARD_AVAILABLE'
        ),

      'multiple_legacy_cards',
        count(*) filter (
          where classification = 'MULTIPLE_LEGACY_CARDS'
        ),

      'no_legacy_card',
        count(*) filter (
          where classification = 'NO_LEGACY_CARD'
        ),

      'inactive_client',
        count(*) filter (
          where classification = 'INACTIVE_CLIENT'
        ),

      'no_active_service',
        count(*) filter (
          where classification = 'NO_ACTIVE_SERVICE'
        )
    )
  into
    v_clients,
    v_summary
  from classified;

  return jsonb_build_object(
    'pauta_id', p_pauta_id,
    'board_id', v_pauta.board_id,
    'clients', v_clients,
    'summary', v_summary,
    'requested_by', v_actor
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.add_clients_to_pauta_v8(p_pauta_id uuid, p_clients jsonb, p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_row jsonb;
  v_client_id uuid;
  v_target_date date;
  v_member public.pauta_members%rowtype;
  v_result jsonb;
  v_added integer := 0;
  v_already_present integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'ADICIONAR CLIENTES' then
    raise exception 'Confirmação inválida. Digite ADICIONAR CLIENTES.';
  end if;

  if p_clients is null
     or jsonb_typeof(p_clients) <> 'array'
     or jsonb_array_length(p_clients) = 0
  then
    raise exception 'Selecione pelo menos um cliente.';
  end if;

  if jsonb_array_length(p_clients) > 300 then
    raise exception 'É permitido incluir no máximo 300 clientes por operação.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in ('draft', 'open') then
    raise exception 'Somente Pautas abertas ou em rascunho podem receber clientes.';
  end if;

  for v_row in
    select value from jsonb_array_elements(p_clients)
  loop
    begin
      v_client_id := (v_row ->> 'client_id')::uuid;
    exception when others then
      raise exception 'A seleção contém cliente inválido.';
    end;

    if not exists (
      select 1 from public.clients
      where id = v_client_id and status = 'active'
    ) then
      raise exception 'Um dos clientes não existe ou está inativo.';
    end if;

    v_target_date := coalesce(
      nullif(v_row ->> 'target_date', '')::date,
      v_pauta.scheduled_until_date
    );

    select *
    into v_member
    from public.pauta_members
    where pauta_id = p_pauta_id
      and client_id = v_client_id
      and membership_status = 'active'
    order by added_at desc
    limit 1
    for update;

    if not found then
      v_result := public.pauta_create_main_card_core(
        p_pauta_id,
        v_client_id,
        v_actor,
        'added'
      );

      select *
      into v_member
      from public.pauta_members
      where pauta_id = p_pauta_id
        and client_id = v_client_id
        and membership_status = 'active'
      order by added_at desc
      limit 1
      for update;

      if not found then
        raise exception 'Não foi possível criar a participação do cliente.';
      end if;

      v_added := v_added + 1;
    else
      v_already_present := v_already_present + 1;
    end if;

    update public.pauta_members
    set
      target_date = v_target_date,
      target_date_updated_at = now(),
      target_date_updated_by = v_actor,
      updated_at = now()
    where id = v_member.id;

    update public.work_items
    set
      internal_deadline = v_pauta.magic_number_date,
      final_deadline = v_target_date,
      updated_at = now()
    where id = v_member.main_work_item_id;

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      v_actor,
      case when v_result is null then 'client_target_date_updated' else 'client_added' end,
      'member',
      v_member.id,
      jsonb_build_object('target_date', v_member.target_date),
      jsonb_build_object(
        'target_date', v_target_date,
        'client_id', v_client_id,
        'legacy_cards_preserved', true
      ),
      '{}'::jsonb
    );

    v_result := null;
  end loop;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'clients_added', v_added,
    'clients_already_present', v_already_present,
    'legacy_cards_adopted', 0
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_work_item_board_assignment_completion(p_assignment_id uuid, p_completed boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_role text;
  v_assignment public.work_item_board_assignments%rowtype;
  v_item public.work_items%rowtype;
  v_target public.board_columns%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_action text;
begin
  v_actor := public.pauta_current_active_actor();

  select role
  into v_role
  from public.profiles
  where id = v_actor
    and is_active = true;

  select *
  into v_assignment
  from public.work_item_board_assignments
  where id = p_assignment_id
    and assignment_status = 'active'
  for update;

  if not found then
    raise exception 'Distribuição ativa não encontrada.';
  end if;

  select *
  into v_item
  from public.work_items
  where id = v_assignment.work_item_id
  for update;

  if not public.app_has_total_access()
     and coalesce(v_role, '') not in ('admin', 'director', 'manager', 'team_lead')
     and v_item.responsible_id is distinct from v_actor
     and v_item.created_by is distinct from v_actor
  then
    raise exception 'Você não possui permissão para concluir esta etapa.';
  end if;

  v_old := jsonb_build_object(
    'board_column_id', v_assignment.board_column_id,
    'operational_status', v_assignment.operational_status,
    'completed_at', v_assignment.completed_at,
    'completed_by', v_assignment.completed_by
  );

  if p_completed then
    select *
    into v_target
    from public.board_columns
    where board_id = v_assignment.board_id
      and operational_status in ('done', 'delivered', 'approved')
    order by position
    limit 1;

    update public.work_item_board_assignments
    set
      board_column_id = coalesce(v_target.id, board_column_id),
      operational_status = coalesce(v_target.operational_status, 'done'),
      completed_at = now(),
      completed_by = v_actor,
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object('completion_note', nullif(trim(coalesce(p_note, '')), '')),
      updated_at = now()
    where id = p_assignment_id
    returning *
    into v_assignment;

    v_action := 'assignment_completed';
  else
    select *
    into v_target
    from public.board_columns
    where board_id = v_assignment.board_id
      and operational_status not in ('done', 'delivered', 'approved')
    order by position
    limit 1;

    update public.work_item_board_assignments
    set
      board_column_id = coalesce(v_target.id, board_column_id),
      operational_status = coalesce(v_target.operational_status, 'in_progress'),
      completed_at = null,
      completed_by = null,
      metadata = coalesce(metadata, '{}'::jsonb)
        - 'completion_note',
      updated_at = now()
    where id = p_assignment_id
    returning *
    into v_assignment;

    v_action := 'assignment_reopened';
  end if;

  v_new := jsonb_build_object(
    'board_column_id', v_assignment.board_column_id,
    'operational_status', v_assignment.operational_status,
    'completed_at', v_assignment.completed_at,
    'completed_by', v_assignment.completed_by
  );

  perform public.v8_log_assignment_event(
    v_assignment.id,
    v_assignment.work_item_id,
    v_item.pauta_id,
    v_assignment.board_id,
    v_assignment.board_column_id,
    v_actor,
    v_action,
    v_old,
    v_new,
    jsonb_build_object('note', nullif(trim(coalesce(p_note, '')), ''))
  );

  if v_item.pauta_id is not null then
    perform public.pauta_log_event(
      v_item.pauta_id,
      v_assignment.board_id,
      v_actor,
      v_action,
      'work_item',
      v_item.id,
      v_old,
      v_new,
      jsonb_build_object('assignment_id', v_assignment.id)
    );
  end if;

  perform public.recalculate_work_item_global_status(v_assignment.work_item_id);

  return jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment.id,
    'work_item_id', v_assignment.work_item_id,
    'completed', p_completed,
    'completed_at', v_assignment.completed_at
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.distribute_existing_pauta_demands(p_pauta_id uuid, p_work_item_ids jsonb, p_targets jsonb, p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_work_item_id uuid;
  v_item public.work_items%rowtype;
  v_target jsonb;
  v_board_id uuid;
  v_column_id uuid;
  v_is_required boolean;
  v_column public.board_columns%rowtype;
  v_assignment public.work_item_board_assignments%rowtype;
  v_count integer := 0;
  v_created integer := 0;
  v_updated integer := 0;
begin
  v_actor := public.pauta_current_active_actor();

  if not public.app_has_total_access() then
    raise exception 'Acesso Total é obrigatório para distribuir demandas.';
  end if;

  if trim(coalesce(p_confirmation, '')) <> 'DISTRIBUIR DEMANDAS' then
    raise exception 'Confirmação inválida. Digite DISTRIBUIR DEMANDAS.';
  end if;

  if p_work_item_ids is null
     or jsonb_typeof(p_work_item_ids) <> 'array'
     or jsonb_array_length(p_work_item_ids) = 0
  then
    raise exception 'Selecione pelo menos uma demanda.';
  end if;

  if p_targets is null
     or jsonb_typeof(p_targets) <> 'array'
     or jsonb_array_length(p_targets) = 0
  then
    raise exception 'Selecione pelo menos um Quadro de destino.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in ('draft', 'open') then
    raise exception 'Somente Pautas abertas ou em rascunho podem distribuir demandas.';
  end if;

  for v_target in
    select value
    from jsonb_array_elements(p_targets)
  loop
    if nullif(
      trim(
        coalesce(
          v_target ->> 'board_id',
          ''
        )
      ),
      ''
    ) is null
    then
      raise exception
        'O Quadro de destino não foi informado.';
    end if;

    if nullif(
      trim(
        coalesce(
          v_target ->> 'board_column_id',
          ''
        )
      ),
      ''
    ) is null
    then
      raise exception
        'A coluna do Quadro de destino não foi informada.';
    end if;

    v_board_id := (v_target ->> 'board_id')::uuid;
    v_column_id := (v_target ->> 'board_column_id')::uuid;

    select column_row.*
    into v_column
    from public.board_columns column_row
    join public.boards board_row
      on board_row.id = column_row.board_id
    where column_row.id = v_column_id
      and column_row.board_id = v_board_id
      and board_row.board_kind = 'custom'
      and board_row.status = 'active';

    if not found then
      raise exception 'Um dos Quadros ou colunas de destino é inválido.';
    end if;
  end loop;

  for v_work_item_id in
    select value::uuid
    from jsonb_array_elements_text(p_work_item_ids) as ids(value)
  loop
    select *
    into v_item
    from public.work_items
    where id = v_work_item_id
      and pauta_id = p_pauta_id
      and coalesce(is_pauta_card, false) in (false, true)
      and status not in ('archived', 'cancelled')
    for update;

    if not found then
      raise exception 'Uma das demandas não pertence à Pauta ou não está ativa.';
    end if;

    for v_target in
      select value
      from jsonb_array_elements(p_targets)
    loop
      v_board_id := (v_target ->> 'board_id')::uuid;
      v_column_id := (v_target ->> 'board_column_id')::uuid;
      v_is_required := coalesce((v_target ->> 'is_required')::boolean, true);

      select *
      into v_column
      from public.board_columns
      where id = v_column_id
        and board_id = v_board_id;

      select *
      into v_assignment
      from public.work_item_board_assignments
      where work_item_id = v_work_item_id
        and board_id = v_board_id
        and assignment_status = 'active'
      for update;

      if found then
        update public.work_item_board_assignments
        set
          board_column_id = v_column_id,
          operational_status = v_column.operational_status,
          is_required = v_is_required,
          metadata = coalesce(metadata, '{}'::jsonb)
            || jsonb_build_object(
              'source', 'pauta_existing_distribution',
              'pauta_id', p_pauta_id,
              'display_mode', 'simple',
              'card_scope', 'sector'
            ),
          completed_at = case
            when public.v8_assignment_is_complete(v_column.operational_status)
              then coalesce(completed_at, now())
            else null
          end,
          completed_by = case
            when public.v8_assignment_is_complete(v_column.operational_status)
              then coalesce(completed_by, v_actor)
            else null
          end,
          updated_at = now()
        where id = v_assignment.id;

        v_updated := v_updated + 1;
      else
        insert into public.work_item_board_assignments (
          work_item_id,
          board_id,
          board_column_id,
          operational_status,
          is_required,
          assignment_status,
          position,
          assigned_by,
          assigned_at,
          completed_by,
          completed_at,
          metadata
        )
        values (
          v_work_item_id,
          v_board_id,
          v_column_id,
          v_column.operational_status,
          v_is_required,
          'active',
          coalesce(
            (
              select max(position) + 1
              from public.work_item_board_assignments
              where board_id = v_board_id
                and board_column_id = v_column_id
                and assignment_status = 'active'
            ),
            0
          ),
          v_actor,
          now(),
          case
            when public.v8_assignment_is_complete(v_column.operational_status)
              then v_actor
            else null
          end,
          case
            when public.v8_assignment_is_complete(v_column.operational_status)
              then now()
            else null
          end,
          jsonb_build_object(
            'source', 'pauta_existing_distribution',
            'pauta_id', p_pauta_id,
            'display_mode', 'simple',
            'card_scope', 'sector'
          )
        )
        returning *
        into v_assignment;

        v_created := v_created + 1;
      end if;

      perform public.v8_log_assignment_event(
        v_assignment.id,
        v_work_item_id,
        p_pauta_id,
        v_board_id,
        v_column_id,
        v_actor,
        'assignment_distributed',
        '{}'::jsonb,
        jsonb_build_object(
          'board_id', v_board_id,
          'board_column_id', v_column_id,
          'is_required', v_is_required,
          'display_mode', 'simple'
        ),
        jsonb_build_object('source', 'pauta_management')
      );

      v_count := v_count + 1;
    end loop;

    perform public.recalculate_work_item_global_status(v_work_item_id);

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      v_actor,
      'demand_distributed_multiboard',
      'work_item',
      v_work_item_id,
      '{}'::jsonb,
      jsonb_build_object('targets', p_targets),
      jsonb_build_object('display_mode', 'simple')
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'assignments_processed', v_count,
    'assignments_created', v_created,
    'assignments_updated', v_updated
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pauta_dependency_summary(p_pauta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;

  v_active_members integer := 0;
  v_removed_members integer := 0;
  v_main_cards integer := 0;
  v_extra_demands integer := 0;
  v_active_items integer := 0;
  v_calendar_events integer := 0;
  v_schedule_requirements integer := 0;
  v_internal_messages integer := 0;
  v_notices integer := 0;
  v_blocking_events integer := 0;
begin
  v_actor := public.pauta_current_active_actor();

  if p_pauta_id is null then
    raise exception 'Pauta obrigatória.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  select
    count(*) filter (
      where membership_status = 'active'
    ),
    count(*) filter (
      where membership_status = 'removed'
    )
  into
    v_active_members,
    v_removed_members
  from public.pauta_members
  where pauta_id = p_pauta_id;

  select
    count(*) filter (
      where is_pauta_card = true
    ),
    count(*) filter (
      where is_pauta_card = false
    ),
    count(*) filter (
      where status not in (
        'archived',
        'cancelled',
        'done',
        'delivered',
        'approved'
      )
    )
  into
    v_main_cards,
    v_extra_demands,
    v_active_items
  from public.work_items
  where pauta_id = p_pauta_id;

  select count(*)
  into v_calendar_events
  from public.calendar_events
  where pauta_id = p_pauta_id;

  select count(*)
  into v_schedule_requirements
  from public.work_item_schedule_requirements as requirement
  join public.work_items as item
    on item.id = requirement.work_item_id
  where item.pauta_id = p_pauta_id;

  if to_regclass('public.internal_messages') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'internal_messages'
         and column_name = 'context_type'
     )
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'internal_messages'
         and column_name = 'context_id'
     )
  then
    execute
      $sql$
        select count(*)
        from public.internal_messages
        where context_type = 'pauta'
          and context_id = $1
      $sql$
    into v_internal_messages
    using p_pauta_id;
  end if;

  if to_regclass('public.avisos') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'avisos'
         and column_name = 'work_item_id'
     )
  then
    execute
      $sql$
        select count(*)
        from public.avisos as aviso
        where aviso.work_item_id in (
          select item.id
          from public.work_items as item
          where item.pauta_id = $1
        )
      $sql$
    into v_notices
    using p_pauta_id;
  end if;

  select count(*)
  into v_blocking_events
  from public.pauta_events
  where pauta_id = p_pauta_id
    and action not in (
      'pauta_created'
    );

  return jsonb_build_object(
    'pauta_id', v_pauta.id,
    'board_id', v_pauta.board_id,
    'name', v_pauta.name,
    'lifecycle_status', v_pauta.lifecycle_status,
    'active_members', v_active_members,
    'removed_members', v_removed_members,
    'main_cards', v_main_cards,
    'extra_demands', v_extra_demands,
    'active_items', v_active_items,
    'calendar_events', v_calendar_events,
    'schedule_requirements', v_schedule_requirements,
    'internal_messages', v_internal_messages,
    'notices', v_notices,
    'blocking_events', v_blocking_events,
    'can_delete',
      v_active_members = 0
      and v_main_cards = 0
      and v_extra_demands = 0
      and v_calendar_events = 0
      and v_schedule_requirements = 0
      and v_internal_messages = 0
      and v_notices = 0
      and v_blocking_events = 0,
    'requested_by', v_actor
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pauta_management_snapshot(p_pauta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_members jsonb := '[]'::jsonb;
  v_extra_demands jsonb := '[]'::jsonb;
  v_legacy_candidates jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_dependencies jsonb := '{}'::jsonb;
begin
  v_actor := public.pauta_current_active_actor();

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'member_id', member.id,
        'membership_status', member.membership_status,
        'source', member.source,
        'target_date', member.target_date,
        'target_date_updated_at', member.target_date_updated_at,
        'target_date_updated_by', member.target_date_updated_by,
        'added_by', member.added_by,
        'added_at', member.added_at,
        'removed_by', member.removed_by,
        'removed_at', member.removed_at,
        'metadata', member.metadata,
        'client', jsonb_build_object(
          'id', client.id,
          'name', client.name,
          'status', client.status,
          'responsible_id', client.responsible_id,
          'drive_folder_url', client.drive_folder_url
        ),
        'main_work_item',
          case
            when item.id is null then null
            else jsonb_build_object(
              'id', item.id,
              'title', item.title,
              'status', item.status,
              'priority', item.priority,
              'board_id', item.board_id,
              'board_column_id', item.board_column_id,
              'responsible_id', item.responsible_id,
              'client_service_id', item.client_service_id,
              'internal_deadline', item.internal_deadline,
              'final_deadline', item.final_deadline,
              'completed_at', item.completed_at,
              'programming_covered_until', item.programming_covered_until
            )
          end
      )
      order by
        member.membership_status,
        client.name,
        member.added_at
    ),
    '[]'::jsonb
  )
  into v_members
  from public.pauta_members member
  join public.clients client
    on client.id = member.client_id
  left join public.work_items item
    on item.id = member.main_work_item_id
  where member.pauta_id = p_pauta_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'title', item.title,
        'client_id', item.client_id,
        'client_name', client.name,
        'pauta_card_id', item.pauta_card_id,
        'status', item.status,
        'priority', item.priority,
        'responsible_id', item.responsible_id,
        'client_service_id', item.client_service_id,
        'internal_deadline', item.internal_deadline,
        'final_deadline', item.final_deadline,
        'drive_link', item.drive_link,
        'notes', item.notes,
        'card_tag', item.card_tag,
        'card_tag_color', item.card_tag_color,
        'completed_at', item.completed_at,
        'assignments', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', assignment.id,
                'board_id', assignment.board_id,
                'board_name', board_row.name,
                'board_color', board_row.color,
                'board_column_id', assignment.board_column_id,
                'board_column_name', column_row.name,
                'board_column_color', column_row.color,
                'operational_status', assignment.operational_status,
                'is_required', assignment.is_required,
                'completed_at', assignment.completed_at,
                'assigned_at', assignment.assigned_at
              )
              order by board_row.name
            )
            from public.work_item_board_assignments assignment
            join public.boards board_row
              on board_row.id = assignment.board_id
            join public.board_columns column_row
              on column_row.id = assignment.board_column_id
            where assignment.work_item_id = item.id
              and assignment.assignment_status = 'active'
          ),
          '[]'::jsonb
        )
      )
      order by client.name, item.created_at desc
    ),
    '[]'::jsonb
  )
  into v_extra_demands
  from public.work_items item
  left join public.clients client
    on client.id = item.client_id
  where item.pauta_id = p_pauta_id
    and item.is_pauta_card = false
    and item.status not in ('archived', 'cancelled');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'work_item_id', item.id,
        'title', item.title,
        'client_id', item.client_id,
        'client_name', client.name,
        'client_status', client.status,
        'status', item.status,
        'priority', item.priority,
        'board_id', item.board_id,
        'board_column_id', item.board_column_id,
        'responsible_id', item.responsible_id,
        'client_service_id', item.client_service_id,
        'internal_deadline', item.internal_deadline,
        'final_deadline', item.final_deadline,
        'created_at', item.created_at
      )
      order by client.name, item.created_at
    ),
    '[]'::jsonb
  )
  into v_legacy_candidates
  from public.work_items item
  join public.clients client
    on client.id = item.client_id
  where item.board_id = v_pauta.board_id
    and item.pauta_id is null
    and item.is_pauta_card = false
    and item.status not in ('archived', 'cancelled')
    and not exists (
      select 1
      from public.pauta_members member
      where member.pauta_id = p_pauta_id
        and member.client_id = item.client_id
        and member.membership_status = 'active'
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'action', event.action,
        'target_type', event.target_type,
        'target_id', event.target_id,
        'actor_id', event.actor_id,
        'actor',
          case
            when actor.id is null then null
            else jsonb_build_object(
              'id', actor.id,
              'full_name', actor.full_name,
              'display_name', actor.display_name,
              'avatar_url', actor.avatar_url
            )
          end,
        'old_values', event.old_values,
        'new_values', event.new_values,
        'metadata', event.metadata,
        'created_at', event.created_at
      )
      order by event.created_at desc
    ),
    '[]'::jsonb
  )
  into v_events
  from (
    select *
    from public.pauta_events
    where pauta_id = p_pauta_id
    order by created_at desc
    limit 300
  ) event
  left join public.profiles actor
    on actor.id = event.actor_id;

  v_dependencies :=
    public.pauta_dependency_summary(p_pauta_id)
    ||
    jsonb_build_object(
      'active_assignments',
        (
          select count(*)
          from public.work_item_board_assignments assignment
          join public.work_items item
            on item.id = assignment.work_item_id
          where item.pauta_id = p_pauta_id
            and assignment.assignment_status = 'active'
        ),
      'pending_required_assignments',
        (
          select count(*)
          from public.work_item_board_assignments assignment
          join public.work_items item
            on item.id = assignment.work_item_id
          where item.pauta_id = p_pauta_id
            and assignment.assignment_status = 'active'
            and assignment.is_required = true
            and not public.v8_assignment_is_complete(
              assignment.operational_status
            )
        )
    );

  return jsonb_build_object(
    'pauta', to_jsonb(v_pauta),
    'members', v_members,
    'extra_demands', v_extra_demands,
    'legacy_candidates', v_legacy_candidates,
    'events', v_events,
    'dependency_summary', v_dependencies,
    'permissions', jsonb_build_object(
      'can_manage', public.app_has_total_access(),
      'can_operate', true
    ),
    'requested_by', v_actor
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.preview_legacy_pauta_import(p_pauta_id uuid)
 RETURNS TABLE(work_item_id uuid, client_id uuid, client_name text, column_id uuid, status text, internal_deadline date, final_deadline date, responsible_id uuid, service_id uuid, candidate_role text, blocker text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
begin
  v_actor :=
    public.pauta_current_active_actor();

  if p_pauta_id is null then
    raise exception
      'Pauta obrigatória.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id;

  if not found then
    raise exception
      'Pauta não encontrada.';
  end if;

  return query
  with candidates as (
    select
      item.id as work_item_id,
      item.client_id,
      client.name as client_name,
      item.board_column_id as column_id,
      item.status::text as item_status,
      item.internal_deadline,
      item.final_deadline,
      item.responsible_id,
      item.client_service_id as service_id,
      client.status::text as client_status,

      count(*) over (
        partition by item.client_id
      ) as client_candidate_count,

      exists (
        select 1
        from public.pauta_members as member
        where member.pauta_id = p_pauta_id
          and member.client_id = item.client_id
          and member.membership_status = 'active'
      ) as already_in_pauta,

      exists (
        select 1
        from public.work_items as existing_main
        where existing_main.pauta_id = p_pauta_id
          and existing_main.client_id = item.client_id
          and existing_main.is_pauta_card = true
      ) as main_card_already_exists,

      (
        item.board_column_id is not null
        and column_row.id is not null
        and column_row.board_id = v_pauta.board_id
      ) as valid_column

    from public.work_items as item

    left join public.clients as client
      on client.id = item.client_id

    left join public.board_columns as column_row
      on column_row.id = item.board_column_id

    where item.board_id = v_pauta.board_id
      and item.pauta_id is null
      and item.is_pauta_card = false
      and item.pauta_card_id is null
      and item.status::text not in (
        'archived',
        'cancelled'
      )
  ),

  classified as (
    select
      candidate.*,

      nullif(
        concat_ws(
          '; ',

          case
            when candidate.client_id is null
              then 'WORK_ITEM_WITHOUT_CLIENT'
          end,

          case
            when candidate.client_id is not null
              and candidate.client_name is null
              then 'CLIENT_NOT_FOUND'
          end,

          case
            when candidate.client_name is not null
              and candidate.client_status
                is distinct from 'active'
              then 'INACTIVE_CLIENT'
          end,

          case
            when not candidate.valid_column
              then 'INVALID_BOARD_COLUMN'
          end,

          case
            when candidate.already_in_pauta
              then 'ALREADY_IN_PAUTA'
          end,

          case
            when candidate.main_card_already_exists
              then 'MAIN_CARD_ALREADY_EXISTS'
          end,

          case
            when candidate.client_candidate_count > 1
              then 'MULTIPLE_LEGACY_CANDIDATES'
          end,

          case
            when candidate.responsible_id is null
              then 'WARNING_MISSING_RESPONSIBLE'
          end,

          case
            when candidate.service_id is null
              then 'WARNING_MISSING_SERVICE'
          end
        ),
        ''
      ) as candidate_blocker

    from candidates as candidate
  )

  select
    classified.work_item_id,
    classified.client_id,
    classified.client_name,
    classified.column_id,
    classified.item_status,
    classified.internal_deadline,
    classified.final_deadline,
    classified.responsible_id,
    classified.service_id,

    case
      when classified.client_id is null
        or classified.client_name is null
        or classified.client_status
          is distinct from 'active'
        or not classified.valid_column
        or classified.already_in_pauta
        or classified.main_card_already_exists
        then 'BLOCKED'

      when classified.client_candidate_count > 1
        then 'REVIEW_REQUIRED'

      when classified.responsible_id is null
        or classified.service_id is null
        then 'MAIN_CANDIDATE_WITH_WARNINGS'

      else 'MAIN_CANDIDATE'
    end as candidate_role,

    classified.candidate_blocker

  from classified

  order by
    classified.client_name nulls last,
    classified.internal_deadline nulls last,
    classified.work_item_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_empty_pauta(p_pauta_id uuid, p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_dependencies jsonb;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'EXCLUIR PAUTA' then
    raise exception
      'Confirmação inválida. Digite EXCLUIR PAUTA.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  v_dependencies :=
    public.pauta_dependency_summary(
      p_pauta_id
    );

  if not coalesce(
    (v_dependencies ->> 'can_delete')::boolean,
    false
  ) then
    raise exception
      'A Pauta possui dependências e não pode ser excluída. Resumo: %.',
      v_dependencies::text;
  end if;

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'pauta_deleted',
    'pauta',
    p_pauta_id,
    to_jsonb(v_pauta),
    jsonb_build_object(
      'deleted_at',
      now()
    ),
    jsonb_build_object(
      'dependency_summary',
      v_dependencies
    )
  );

  delete from public.pautas
  where id = p_pauta_id;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'deleted', true
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_pauta_demand(p_pauta_id uuid, p_client_id uuid, p_board_column_id uuid, p_title text, p_client_service_id uuid, p_responsible_id uuid, p_priority text, p_internal_deadline date, p_final_deadline date, p_drive_link text, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_member public.pauta_members%rowtype;
  v_column public.board_columns%rowtype;
  v_work_item_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_priority text := trim(coalesce(p_priority, 'normal'));
  v_initial_status text;
begin
  v_actor := public.pauta_current_active_actor();

  if p_pauta_id is null then
    raise exception 'Pauta obrigatória.';
  end if;

  if p_client_id is null then
    raise exception 'Cliente obrigatório.';
  end if;

  if p_board_column_id is null then
    raise exception 'Coluna obrigatória.';
  end if;

  if length(v_title) not between 2 and 180 then
    raise exception
      'O título deve possuir entre 2 e 180 caracteres.';
  end if;

  if v_priority not in (
    'low',
    'normal',
    'high',
    'urgent'
  ) then
    raise exception 'Prioridade inválida.';
  end if;

  if p_responsible_id is null then
    raise exception 'Responsável obrigatório.';
  end if;

  if p_internal_deadline is null
     or p_final_deadline is null
  then
    raise exception
      'Início e prazo final são obrigatórios.';
  end if;

  if p_internal_deadline > p_final_deadline then
    raise exception
      'A data inicial não pode ser posterior ao prazo final.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in (
    'draft',
    'open'
  ) then
    raise exception
      'Somente Pautas abertas ou em rascunho podem receber demandas.';
  end if;

  select *
  into v_member
  from public.pauta_members
  where pauta_id = p_pauta_id
    and client_id = p_client_id
    and membership_status = 'active'
  order by added_at desc
  limit 1;

  if not found
     or v_member.main_work_item_id is null
  then
    raise exception
      'O cliente não possui participação ativa e card principal nesta Pauta.';
  end if;

  if not exists (
    select 1
    from public.work_items
    where id = v_member.main_work_item_id
      and pauta_id = p_pauta_id
      and client_id = p_client_id
      and is_pauta_card = true
  ) then
    raise exception
      'O card principal do cliente está inconsistente.';
  end if;

  select *
  into v_column
  from public.board_columns
  where id = p_board_column_id
    and board_id = v_pauta.board_id;

  if not found then
    raise exception
      'A coluna selecionada não pertence ao Quadro da Pauta.';
  end if;

  v_initial_status :=
    case
      when coalesce(v_column.operational_status, '') in (
        'done',
        'delivered',
        'approved'
      ) then 'not_started'
      else coalesce(
        v_column.operational_status,
        'not_started'
      )
    end;

  if not exists (
    select 1
    from public.profiles
    where id = p_responsible_id
      and is_active = true
  ) then
    raise exception
      'Responsável não encontrado ou inativo.';
  end if;

  if p_client_service_id is null then
    raise exception
      'Demandas operacionais de cliente precisam de um serviço ativo.';
  end if;

  if not exists (
    select 1
    from public.client_services
    where id = p_client_service_id
      and client_id = p_client_id
      and status = 'active'
  ) then
    raise exception
      'O serviço não está ativo ou não pertence ao cliente.';
  end if;

  insert into public.work_items (
    title,
    description,
    type,
    origin,
    destino,
    status,
    priority,
    client_id,
    client_service_id,
    responsible_id,
    board_id,
    board_column_id,
    internal_deadline,
    final_deadline,
    drive_link,
    notes,
    blocked_reason,
    created_by,
    closed_at,
    pauta_id,
    is_pauta_card,
    pauta_card_id,
    completed_at
  )
  values (
    v_title,
    null,
    'Operação',
    'planned',
    'quadro',
    v_initial_status,
    v_priority,
    p_client_id,
    p_client_service_id,
    p_responsible_id,
    v_pauta.board_id,
    p_board_column_id,
    p_internal_deadline,
    p_final_deadline,
    nullif(trim(coalesce(p_drive_link, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    null,
    v_actor,
    null,
    p_pauta_id,
    false,
    v_member.main_work_item_id,
    null
  )
  returning id
  into v_work_item_id;

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    v_work_item_id,
    v_actor,
    'pauta_demand_created',
    null,
    jsonb_build_object(
      'pauta_id', p_pauta_id,
      'pauta_card_id', v_member.main_work_item_id,
      'board_column_id', p_board_column_id,
      'status', v_initial_status,
      'completion_requires_explicit_action', true
    )::text
  );

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'demand_created',
    'work_item',
    v_work_item_id,
    '{}'::jsonb,
    jsonb_build_object(
      'client_id', p_client_id,
      'main_work_item_id', v_member.main_work_item_id,
      'board_column_id', p_board_column_id,
      'client_service_id', p_client_service_id,
      'responsible_id', p_responsible_id,
      'status', v_initial_status,
      'completion_requires_explicit_action', true
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'work_item_id', v_work_item_id,
    'pauta_card_id', v_member.main_work_item_id,
    'status', v_initial_status,
    'completion_requires_explicit_action', true
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.v8_assignment_after_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_work_item_global_status(old.work_item_id);
    return old;
  end if;

  perform public.recalculate_work_item_global_status(new.work_item_id);

  if tg_op = 'UPDATE'
     and old.work_item_id is distinct from new.work_item_id
  then
    perform public.recalculate_work_item_global_status(old.work_item_id);
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.v8_assignment_is_complete(p_status text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce(p_status, '') in ('done', 'delivered', 'approved');
$function$
;

CREATE OR REPLACE FUNCTION public.change_pauta_lifecycle(p_pauta_id uuid, p_action text, p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_expected_confirmation text;
  v_next_status text;
  v_pending_main_cards integer := 0;
  v_pending_assignments integer := 0;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  v_actor := public.pauta_management_actor();

  if v_action not in ('close', 'reopen', 'archive') then
    raise exception 'Ação de ciclo de vida inválida.';
  end if;

  v_expected_confirmation :=
    case v_action
      when 'close' then 'CONCLUIR PAUTA'
      when 'reopen' then 'REABRIR PAUTA'
      when 'archive' then 'ARQUIVAR PAUTA'
    end;

  if trim(coalesce(p_confirmation, '')) <> v_expected_confirmation then
    raise exception
      'Confirmação inválida. Digite %.',
      v_expected_confirmation;
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  v_old_values := jsonb_build_object(
    'lifecycle_status', v_pauta.lifecycle_status,
    'opened_at', v_pauta.opened_at,
    'closed_at', v_pauta.closed_at,
    'archived_at', v_pauta.archived_at
  );

  if v_action = 'close' then
    if v_pauta.lifecycle_status not in ('draft', 'open') then
      raise exception
        'Somente Pautas abertas ou em rascunho podem ser concluídas.';
    end if;

    select count(*)
    into v_pending_main_cards
    from public.pauta_members member
    join public.work_items item
      on item.id = member.main_work_item_id
    where member.pauta_id = p_pauta_id
      and member.membership_status = 'active'
      and item.is_pauta_card = true
      and item.completed_at is null
      and item.status not in ('done', 'delivered', 'approved');

    select count(*)
    into v_pending_assignments
    from public.work_item_board_assignments assignment
    join public.work_items item
      on item.id = assignment.work_item_id
    where item.pauta_id = p_pauta_id
      and item.is_pauta_card = false
      and assignment.assignment_status = 'active'
      and assignment.is_required = true
      and not public.v8_assignment_is_complete(
        assignment.operational_status
      );

    if v_pending_main_cards > 0
       or v_pending_assignments > 0
    then
      raise exception
        'A Pauta ainda possui % card(s) mensal(is) e % distribuição(ões) obrigatória(s) pendente(s).',
        v_pending_main_cards,
        v_pending_assignments;
    end if;

    v_next_status := 'closed';

    update public.pautas
    set
      lifecycle_status = 'closed',
      closed_at = now(),
      archived_at = null,
      updated_at = now()
    where id = p_pauta_id;

  elsif v_action = 'reopen' then
    if v_pauta.lifecycle_status not in ('closed', 'archived') then
      raise exception
        'Somente Pautas concluídas ou arquivadas podem ser reabertas.';
    end if;

    v_next_status := 'open';

    update public.pautas
    set
      lifecycle_status = 'open',
      opened_at = coalesce(opened_at, now()),
      closed_at = null,
      archived_at = null,
      updated_at = now()
    where id = p_pauta_id;

  else
    if v_pauta.lifecycle_status = 'archived' then
      raise exception 'A Pauta já está arquivada.';
    end if;

    v_next_status := 'archived';

    update public.pautas
    set
      lifecycle_status = 'archived',
      archived_at = now(),
      updated_at = now()
    where id = p_pauta_id;
  end if;

  select jsonb_build_object(
    'lifecycle_status', pauta.lifecycle_status,
    'opened_at', pauta.opened_at,
    'closed_at', pauta.closed_at,
    'archived_at', pauta.archived_at
  )
  into v_new_values
  from public.pautas pauta
  where pauta.id = p_pauta_id;

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'lifecycle_' || v_action,
    'pauta',
    p_pauta_id,
    v_old_values,
    v_new_values,
    jsonb_build_object(
      'pending_main_cards', v_pending_main_cards,
      'pending_required_assignments', v_pending_assignments
    )
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'previous_status', v_pauta.lifecycle_status,
    'lifecycle_status', v_next_status
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_pauta_member_target_date(p_member_id uuid, p_target_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_member public.pauta_members%rowtype;
  v_pauta public.pautas%rowtype;
  v_old_date date;
begin
  v_actor := public.pauta_management_actor();

  if p_target_date is null then
    raise exception 'Informe uma data-meta válida.';
  end if;

  select *
  into v_member
  from public.pauta_members
  where id = p_member_id
    and membership_status = 'active'
  for update;

  if not found then
    raise exception 'Participação ativa não encontrada.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = v_member.pauta_id
  for update;

  if v_pauta.lifecycle_status not in ('draft', 'open') then
    raise exception
      'Somente Pautas abertas ou em rascunho podem alterar a data-meta.';
  end if;

  v_old_date := v_member.target_date;

  update public.pauta_members
  set
    target_date = p_target_date,
    target_date_updated_at = now(),
    target_date_updated_by = v_actor,
    updated_at = now()
  where id = p_member_id;

  update public.work_items
  set
    final_deadline = p_target_date,
    internal_deadline = v_pauta.magic_number_date,
    updated_at = now()
  where id = v_member.main_work_item_id;

  perform public.pauta_log_event(
    v_member.pauta_id,
    v_pauta.board_id,
    v_actor,
    'client_target_date_updated',
    'member',
    p_member_id,
    jsonb_build_object(
      'target_date', v_old_date
    ),
    jsonb_build_object(
      'target_date', p_target_date,
      'client_id', v_member.client_id
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'member_id', p_member_id,
    'target_date', p_target_date
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_pauta_clients_batch(p_pauta_id uuid, p_client_ids uuid[], p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_client_id uuid;
  v_removed integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'RETIRAR CLIENTES' then
    raise exception
      'Confirmação inválida. Digite RETIRAR CLIENTES.';
  end if;

  if p_client_ids is null or cardinality(p_client_ids) = 0 then
    raise exception 'Selecione pelo menos um cliente.';
  end if;

  for v_client_id in
    select distinct unnest(p_client_ids)
  loop
    perform public.remove_client_from_pauta(
      p_pauta_id,
      v_client_id,
      'RETIRAR CLIENTE'
    );

    v_removed := v_removed + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'clients_removed', v_removed,
    'actor_id', v_actor
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_pauta_demands_batch(p_pauta_id uuid, p_work_item_ids uuid[], p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_work_item_id uuid;
  v_removed integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'RETIRAR DEMANDAS' then
    raise exception
      'Confirmação inválida. Digite RETIRAR DEMANDAS.';
  end if;

  if p_work_item_ids is null or cardinality(p_work_item_ids) = 0 then
    raise exception 'Selecione pelo menos uma demanda.';
  end if;

  for v_work_item_id in
    select distinct unnest(p_work_item_ids)
  loop
    perform public.detach_pauta_demand(
      p_pauta_id,
      v_work_item_id,
      'RETIRAR DEMANDA'
    );

    v_removed := v_removed + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'demands_removed', v_removed,
    'actor_id', v_actor
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_and_distribute_pauta_demands(p_pauta_id uuid, p_rows jsonb, p_targets jsonb, p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_row jsonb;
  v_target jsonb;
  v_member public.pauta_members%rowtype;
  v_client public.clients%rowtype;
  v_client_id uuid;
  v_service_id uuid;
  v_responsible_id uuid;
  v_start_date date;
  v_final_date date;
  v_priority text;
  v_title text;
  v_drive_link text;
  v_notes text;
  v_card_tag text;
  v_card_tag_color text;
  v_work_item_id uuid;
  v_board_id uuid;
  v_column_id uuid;
  v_column public.board_columns%rowtype;
  v_assignment_id uuid;
  v_is_required boolean;
  v_created jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'CRIAR E DISTRIBUIR' then
    raise exception
      'Confirmação inválida. Digite CRIAR E DISTRIBUIR.';
  end if;

  if p_rows is null
     or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) = 0
  then
    raise exception 'Selecione pelo menos um cliente.';
  end if;

  if p_targets is null
     or jsonb_typeof(p_targets) <> 'array'
     or jsonb_array_length(p_targets) = 0
  then
    raise exception 'Selecione pelo menos um Quadro de destino.';
  end if;

  if jsonb_array_length(p_rows) > 100 then
    raise exception
      'É permitido criar no máximo 100 demandas por operação.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in ('draft', 'open') then
    raise exception
      'Somente Pautas abertas ou em rascunho podem receber demandas.';
  end if;

  for v_target in
    select value
    from jsonb_array_elements(p_targets)
  loop
    v_board_id := (v_target ->> 'board_id')::uuid;
    v_column_id := (v_target ->> 'board_column_id')::uuid;

    select column_row.*
    into v_column
    from public.board_columns column_row
    join public.boards board_row
      on board_row.id = column_row.board_id
    where column_row.id = v_column_id
      and column_row.board_id = v_board_id
      and board_row.board_kind = 'custom'
      and board_row.status = 'active';

    if not found then
      raise exception
        'Um dos Quadros ou colunas de destino é inválido.';
    end if;
  end loop;

  for v_row in
    select value
    from jsonb_array_elements(p_rows)
  loop
    v_client_id := (v_row ->> 'client_id')::uuid;
    v_service_id := (v_row ->> 'client_service_id')::uuid;
    v_responsible_id := (v_row ->> 'responsible_id')::uuid;
    v_start_date := (v_row ->> 'internal_deadline')::date;
    v_final_date := (v_row ->> 'final_deadline')::date;
    v_priority := coalesce(nullif(v_row ->> 'priority', ''), 'normal');
    v_drive_link := nullif(trim(coalesce(v_row ->> 'drive_link', '')), '');
    v_notes := nullif(trim(coalesce(v_row ->> 'notes', '')), '');
    v_card_tag := nullif(
      upper(
        left(
          regexp_replace(
            trim(coalesce(v_row ->> 'card_tag', '')),
            '\s+',
            ' ',
            'g'
          ),
          16
        )
      ),
      ''
    );
    v_card_tag_color := coalesce(
      nullif(v_row ->> 'card_tag_color', ''),
      'slate'
    );

    if v_priority not in ('low', 'normal', 'high', 'urgent') then
      raise exception 'Prioridade inválida.';
    end if;

    if v_card_tag_color not in (
      'slate',
      'blue',
      'purple',
      'yellow',
      'red',
      'green'
    ) then
      v_card_tag_color := 'slate';
    end if;

    if v_start_date is null
       or v_final_date is null
       or v_start_date > v_final_date
    then
      raise exception
        'Informe um período válido para todas as demandas.';
    end if;

    select *
    into v_member
    from public.pauta_members
    where pauta_id = p_pauta_id
      and client_id = v_client_id
      and membership_status = 'active'
    order by added_at desc
    limit 1;

    if not found or v_member.main_work_item_id is null then
      raise exception
        'Um dos clientes não participa ativamente desta Pauta.';
    end if;

    select *
    into v_client
    from public.clients
    where id = v_client_id
      and status = 'active';

    if not found then
      raise exception 'Cliente não encontrado ou inativo.';
    end if;

    if not exists (
      select 1
      from public.client_services
      where id = v_service_id
        and client_id = v_client_id
        and status = 'active'
    ) then
      raise exception
        'Um dos serviços não está ativo ou não pertence ao cliente.';
    end if;

    if not exists (
      select 1
      from public.profiles
      where id = v_responsible_id
        and is_active = true
    ) then
      raise exception
        'Responsável não encontrado ou inativo.';
    end if;

    v_title :=
      upper(v_client.name)
      || ' - '
      || to_char(v_start_date, 'DD/MM')
      || ' - '
      || to_char(v_final_date, 'DD/MM');

    insert into public.work_items (
      title,
      description,
      type,
      origin,
      destino,
      status,
      priority,
      client_id,
      client_service_id,
      responsible_id,
      board_id,
      board_column_id,
      internal_deadline,
      final_deadline,
      drive_link,
      notes,
      created_by,
      pauta_id,
      is_pauta_card,
      pauta_card_id,
      card_tag,
      card_tag_color
    )
    values (
      v_title,
      null,
      'Operação',
      'planned',
      'quadro',
      'not_started',
      v_priority,
      v_client_id,
      v_service_id,
      v_responsible_id,
      null,
      null,
      v_start_date,
      v_final_date,
      v_drive_link,
      v_notes,
      v_actor,
      p_pauta_id,
      false,
      v_member.main_work_item_id,
      v_card_tag,
      v_card_tag_color
    )
    returning id
    into v_work_item_id;

    insert into public.work_item_history (
      work_item_id,
      actor_id,
      field_changed,
      old_value,
      new_value
    )
    values (
      v_work_item_id,
      v_actor,
      'pauta_demand_created_multiboard',
      null,
      jsonb_build_object(
        'pauta_id', p_pauta_id,
        'client_id', v_client_id,
        'targets', p_targets
      )::text
    );

    for v_target in
      select value
      from jsonb_array_elements(p_targets)
    loop
      v_board_id := (v_target ->> 'board_id')::uuid;
      v_column_id := (v_target ->> 'board_column_id')::uuid;
      v_is_required := coalesce(
        (v_target ->> 'is_required')::boolean,
        true
      );

      select *
      into v_column
      from public.board_columns
      where id = v_column_id
        and board_id = v_board_id;

      insert into public.work_item_board_assignments (
        work_item_id,
        board_id,
        board_column_id,
        operational_status,
        is_required,
        assignment_status,
        position,
        assigned_by,
        assigned_at,
        completed_by,
        completed_at,
        metadata
      )
      values (
        v_work_item_id,
        v_board_id,
        v_column_id,
        v_column.operational_status,
        v_is_required,
        'active',
        coalesce(
          (
            select max(position) + 1
            from public.work_item_board_assignments
            where board_id = v_board_id
              and board_column_id = v_column_id
              and assignment_status = 'active'
          ),
          0
        ),
        v_actor,
        now(),
        case
          when public.v8_assignment_is_complete(
            v_column.operational_status
          )
            then v_actor
          else null
        end,
        case
          when public.v8_assignment_is_complete(
            v_column.operational_status
          )
            then now()
          else null
        end,
        jsonb_build_object(
          'source', 'pauta_distribution',
          'pauta_id', p_pauta_id
        )
      )
      returning id
      into v_assignment_id;

      perform public.v8_log_assignment_event(
        v_assignment_id,
        v_work_item_id,
        p_pauta_id,
        v_board_id,
        v_column_id,
        v_actor,
        'assignment_created',
        '{}'::jsonb,
        jsonb_build_object(
          'board_id', v_board_id,
          'board_column_id', v_column_id,
          'operational_status', v_column.operational_status,
          'is_required', v_is_required
        ),
        '{}'::jsonb
      );
    end loop;

    perform public.recalculate_work_item_global_status(
      v_work_item_id
    );

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      v_actor,
      'demand_created_multiboard',
      'work_item',
      v_work_item_id,
      '{}'::jsonb,
      jsonb_build_object(
        'client_id', v_client_id,
        'pauta_card_id', v_member.main_work_item_id,
        'targets', p_targets
      ),
      '{}'::jsonb
    );

    v_created :=
      v_created ||
      jsonb_build_array(
        jsonb_build_object(
          'work_item_id', v_work_item_id,
          'client_id', v_client_id,
          'title', v_title
        )
      );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'demands_created', v_count,
    'items', v_created
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.move_work_item_board_assignment(p_assignment_id uuid, p_target_column_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_assignment public.work_item_board_assignments%rowtype;
  v_item public.work_items%rowtype;
  v_target public.board_columns%rowtype;
  v_old_values jsonb;
  v_new_values jsonb;
  v_next_operational_status text;
begin
  v_actor := public.pauta_current_active_actor();

  select *
  into v_assignment
  from public.work_item_board_assignments
  where id = p_assignment_id
    and assignment_status = 'active'
  for update;

  if not found then
    raise exception 'Distribuição ativa não encontrada.';
  end if;

  select *
  into v_item
  from public.work_items
  where id = v_assignment.work_item_id
  for update;

  if not public.app_has_total_access()
     and v_item.responsible_id is distinct from v_actor
     and v_item.created_by is distinct from v_actor
  then
    raise exception
      'Você não possui permissão para movimentar esta demanda.';
  end if;

  select *
  into v_target
  from public.board_columns
  where id = p_target_column_id
    and board_id = v_assignment.board_id;

  if not found then
    raise exception
      'A coluna de destino deve pertencer ao mesmo Quadro.';
  end if;

  v_next_operational_status :=
    case
      when public.v8_assignment_is_complete(v_target.operational_status)
        then v_assignment.operational_status
      else v_target.operational_status
    end;

  v_old_values := jsonb_build_object(
    'board_column_id', v_assignment.board_column_id,
    'operational_status', v_assignment.operational_status,
    'completed_at', v_assignment.completed_at,
    'completed_by', v_assignment.completed_by
  );

  update public.work_item_board_assignments
  set
    board_column_id = p_target_column_id,
    operational_status = v_next_operational_status,
    updated_at = now()
  where id = p_assignment_id;

  v_new_values := jsonb_build_object(
    'board_column_id', p_target_column_id,
    'operational_status', v_next_operational_status,
    'completed_at', v_assignment.completed_at,
    'completed_by', v_assignment.completed_by
  );

  perform public.v8_log_assignment_event(
    p_assignment_id,
    v_assignment.work_item_id,
    v_item.pauta_id,
    v_assignment.board_id,
    p_target_column_id,
    v_actor,
    'assignment_moved',
    v_old_values,
    v_new_values,
    jsonb_build_object(
      'completion_requires_explicit_action', true
    )
  );

  if v_item.pauta_id is not null then
    perform public.pauta_log_event(
      v_item.pauta_id,
      v_assignment.board_id,
      v_actor,
      'assignment_moved',
      'work_item',
      v_item.id,
      v_old_values,
      v_new_values,
      jsonb_build_object(
        'assignment_id', p_assignment_id,
        'completion_requires_explicit_action', true
      )
    );
  end if;

  perform public.recalculate_work_item_global_status(
    v_assignment.work_item_id
  );

  return jsonb_build_object(
    'success', true,
    'assignment_id', p_assignment_id,
    'work_item_id', v_assignment.work_item_id,
    'board_column_id', p_target_column_id,
    'operational_status', v_next_operational_status,
    'completed', v_assignment.completed_at is not null
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.v9_prepare_simple_assignment_card()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if coalesce(new.metadata ->> 'source', '') in (
    'pauta_distribution',
    'pauta_existing_distribution'
  ) then
    new.metadata :=
      coalesce(new.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'display_mode', 'simple',
        'card_scope', 'sector'
      );
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_calendar_event_completion(p_event_id uuid, p_completed boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_role text;
  v_event public.calendar_events%rowtype;
  v_old jsonb;
  v_new jsonb;
begin
  v_actor := public.pauta_current_active_actor();

  select role
  into v_role
  from public.profiles
  where id = v_actor
    and is_active = true;

  select *
  into v_event
  from public.calendar_events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Agenda não encontrada.';
  end if;

  if not public.app_has_total_access()
     and coalesce(v_role, '') not in ('admin', 'director', 'manager', 'team_lead')
     and v_event.responsible_id is distinct from v_actor
     and v_event.created_by is distinct from v_actor
  then
    raise exception 'Você não possui permissão para concluir esta agenda.';
  end if;

  v_old := jsonb_build_object(
    'completion_status', v_event.completion_status,
    'completed_at', v_event.completed_at,
    'completed_by', v_event.completed_by,
    'completion_note', v_event.completion_note
  );

  update public.calendar_events
  set
    completion_status = case when p_completed then 'completed' else 'open' end,
    completed_at = case when p_completed then now() else null end,
    completed_by = case when p_completed then v_actor else null end,
    completion_note = case
      when p_completed then nullif(trim(coalesce(p_note, '')), '')
      else null
    end,
    updated_at = now()
  where id = p_event_id
  returning *
  into v_event;

  v_new := jsonb_build_object(
    'completion_status', v_event.completion_status,
    'completed_at', v_event.completed_at,
    'completed_by', v_event.completed_by,
    'completion_note', v_event.completion_note
  );

  insert into public.calendar_event_history (
    event_id,
    actor_id,
    action,
    old_values,
    new_values,
    metadata
  )
  values (
    p_event_id,
    v_actor,
    case when p_completed then 'completed' else 'reopened' end,
    v_old,
    v_new,
    jsonb_build_object('work_item_id', v_event.work_item_id)
  );

  if v_event.work_item_id is not null then
    insert into public.work_item_history (
      work_item_id,
      actor_id,
      field_changed,
      old_value,
      new_value
    )
    values (
      v_event.work_item_id,
      v_actor,
      case
        when p_completed then 'calendar_event_completed'
        else 'calendar_event_reopened'
      end,
      v_old::text,
      v_new::text
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'completed', p_completed,
    'completed_at', v_event.completed_at,
    'completed_by', v_event.completed_by
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_work_item_completion(p_work_item_id uuid, p_completed boolean, p_complete_assignments boolean DEFAULT true, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_role text;
  v_item public.work_items%rowtype;
  v_assignment record;
  v_assignment_count integer := 0;
  v_old_status text;
begin
  v_actor := public.pauta_current_active_actor();

  select role
  into v_role
  from public.profiles
  where id = v_actor
    and is_active = true;

  select *
  into v_item
  from public.work_items
  where id = p_work_item_id
  for update;

  if not found then
    raise exception 'Demanda não encontrada.';
  end if;

  if not public.app_has_total_access()
     and coalesce(v_role, '') not in ('admin', 'director', 'manager', 'team_lead')
     and v_item.responsible_id is distinct from v_actor
     and v_item.created_by is distinct from v_actor
  then
    raise exception 'Você não possui permissão para concluir esta demanda.';
  end if;

  v_old_status := v_item.status;

  select count(*)
  into v_assignment_count
  from public.work_item_board_assignments
  where work_item_id = p_work_item_id
    and assignment_status = 'active';

  if v_assignment_count > 0 and not p_complete_assignments then
    raise exception 'Esta demanda possui etapas em Quadros. Conclua as etapas ou confirme a conclusão completa.';
  end if;

  if v_assignment_count > 0 then
    for v_assignment in
      select id
      from public.work_item_board_assignments
      where work_item_id = p_work_item_id
        and assignment_status = 'active'
      order by assigned_at
    loop
      perform public.set_work_item_board_assignment_completion(
        v_assignment.id,
        p_completed,
        p_note
      );
    end loop;
  else
    update public.work_items
    set
      status = case when p_completed then 'done' else 'not_started' end,
      completed_at = case when p_completed then now() else null end,
      completed_by = case when p_completed then v_actor else null end,
      closed_at = case when p_completed then now() else null end,
      close_reason = case
        when p_completed then nullif(trim(coalesce(p_note, '')), '')
        else null
      end,
      updated_at = now()
    where id = p_work_item_id;
  end if;

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    p_work_item_id,
    v_actor,
    case when p_completed then 'completed' else 'reopened' end,
    v_old_status,
    jsonb_build_object(
      'status', case when p_completed then 'done' else 'not_started' end,
      'note', nullif(trim(coalesce(p_note, '')), ''),
      'assignments', v_assignment_count,
      'explicit_action', true
    )::text
  );

  return jsonb_build_object(
    'success', true,
    'work_item_id', p_work_item_id,
    'completed', p_completed,
    'assignments_updated', v_assignment_count,
    'explicit_action', true
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_pauta_extra_demands_v92c(p_pauta_id uuid, p_work_item_ids uuid[], p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_invalid_count integer;
begin
  if not public.app_has_total_access() then
    raise exception
      'Acesso Total é obrigatório para retirar demandas.';
  end if;

  if trim(
    coalesce(
      p_confirmation,
      ''
    )
  ) <> 'RETIRAR DEMANDAS'
  then
    raise exception
      'Confirmação inválida. Digite RETIRAR DEMANDAS.';
  end if;

  if
    p_work_item_ids is null
    or cardinality(
      p_work_item_ids
    ) = 0
  then
    raise exception
      'Selecione pelo menos uma demanda adicional.';
  end if;

  select count(*)
  into v_invalid_count
  from unnest(
    p_work_item_ids
  ) as selected(
    work_item_id
  )
  left join public.work_items item
    on item.id =
      selected.work_item_id
  where
    item.id is null
    or item.pauta_id
      is distinct from
      p_pauta_id
    or coalesce(
      item.is_pauta_card,
      false
    ) = true
    or item.status in (
      'archived',
      'cancelled'
    );

  if v_invalid_count > 0 then
    raise exception
      'A remoção aceita apenas demandas adicionais ativas da Pauta. Cards principais não podem ser retirados por esta ação.';
  end if;

  return
    public.remove_pauta_demands_batch(
      p_pauta_id,
      p_work_item_ids,
      p_confirmation
    );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_work_item_board_assignment(p_assignment_id uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_role text;
  v_assignment public.work_item_board_assignments%rowtype;
  v_item public.work_items%rowtype;
  v_old jsonb;
  v_new jsonb;
begin
  v_actor := public.pauta_current_active_actor();

  select role
  into v_role
  from public.profiles
  where id = v_actor
    and is_active = true;

  select *
  into v_assignment
  from public.work_item_board_assignments
  where id = p_assignment_id
    and assignment_status = 'active'
  for update;

  if not found then
    raise exception 'Distribuição ativa não encontrada.';
  end if;

  select *
  into v_item
  from public.work_items
  where id = v_assignment.work_item_id
  for update;

  if not public.app_has_total_access()
     and coalesce(v_role, '') not in ('admin', 'director', 'manager', 'team_lead')
     and v_item.responsible_id is distinct from v_actor
     and v_item.created_by is distinct from v_actor
  then
    raise exception 'Você não possui permissão para remover esta associação.';
  end if;

  v_old := jsonb_build_object(
    'assignment_status', v_assignment.assignment_status,
    'board_id', v_assignment.board_id,
    'board_column_id', v_assignment.board_column_id,
    'operational_status', v_assignment.operational_status,
    'completed_at', v_assignment.completed_at
  );

  update public.work_item_board_assignments
  set
    assignment_status = 'removed',
    removed_at = now(),
    removed_by = v_actor,
    completed_at = null,
    completed_by = null,
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'removal_note',
        nullif(trim(coalesce(p_note, '')), '')
      ),
    updated_at = now()
  where id = p_assignment_id
  returning *
  into v_assignment;

  v_new := jsonb_build_object(
    'assignment_status', v_assignment.assignment_status,
    'board_id', v_assignment.board_id,
    'board_column_id', v_assignment.board_column_id,
    'operational_status', v_assignment.operational_status,
    'removed_at', v_assignment.removed_at,
    'removed_by', v_assignment.removed_by
  );

  perform public.v8_log_assignment_event(
    v_assignment.id,
    v_assignment.work_item_id,
    v_item.pauta_id,
    v_assignment.board_id,
    v_assignment.board_column_id,
    v_actor,
    'assignment_removed',
    v_old,
    v_new,
    jsonb_build_object(
      'note',
      nullif(trim(coalesce(p_note, '')), '')
    )
  );

  if v_item.pauta_id is not null then
    perform public.pauta_log_event(
      v_item.pauta_id,
      v_assignment.board_id,
      v_actor,
      'assignment_removed',
      'work_item',
      v_item.id,
      v_old,
      v_new,
      jsonb_build_object(
        'assignment_id', v_assignment.id,
        'note', nullif(trim(coalesce(p_note, '')), '')
      )
    );
  end if;

  perform public.recalculate_work_item_global_status(
    v_assignment.work_item_id
  );

  return jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment.id,
    'work_item_id', v_assignment.work_item_id,
    'board_id', v_assignment.board_id,
    'removed', true
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.meta_sync_secret()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select decrypted_secret from vault.decrypted_secrets where name = 'meta_sync_secret' limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.meta_enqueue_sync(p_days integer DEFAULT 7, p_mode text DEFAULT 'sync'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'meta_sync_secret' limit 1);
  v_url text := 'https://epzrrsaibqdcaafkvwmm.supabase.co/functions/v1/meta-sync';
  v_acc record;
  v_n integer := 0;
begin
  if p_mode = 'discover' then
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', v_secret),
      body := jsonb_build_object('mode', 'discover'),
      timeout_milliseconds := 60000
    );
    return 1;
  end if;

  for v_acc in select meta_account_id from public.meta_ad_accounts where is_selected loop
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', v_secret),
      body := jsonb_build_object('mode', 'sync', 'meta_account_id', v_acc.meta_account_id, 'days', p_days),
      timeout_milliseconds := 150000
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end $function$
;

CREATE TRIGGER trg_avisos_updated_at BEFORE UPDATE ON public.avisos FOR EACH ROW EXECUTE FUNCTION set_avisos_updated_at();

CREATE TRIGGER trg_seed_board_default_columns AFTER INSERT ON public.boards FOR EACH ROW EXECUTE FUNCTION seed_board_default_columns();

CREATE TRIGGER set_updated_at_calendar_events BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_calendar_event_clear_cycle_requirement BEFORE DELETE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION sync_cycle_schedule_requirement_from_calendar_event();

CREATE TRIGGER trg_calendar_event_sync_cycle_requirement AFTER INSERT OR UPDATE OF work_item_id, type, starts_at, confirmed ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION sync_cycle_schedule_requirement_from_calendar_event();

CREATE TRIGGER trg_calendar_event_sync_pauta BEFORE INSERT OR UPDATE OF work_item_id, pauta_id ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION sync_calendar_event_pauta();

CREATE TRIGGER validate_calendar_links BEFORE INSERT OR UPDATE OF client_id, work_item_id ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION app_validate_calendar_links();

CREATE TRIGGER set_updated_at_client_services BEFORE UPDATE ON public.client_services FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_clients BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER comercial_leads_touch BEFORE UPDATE ON public.comercial_leads FOR EACH ROW EXECUTE FUNCTION comercial_touch();

CREATE TRIGGER comercial_reunioes_touch BEFORE UPDATE ON public.comercial_reunioes FOR EACH ROW EXECUTE FUNCTION comercial_touch();

CREATE TRIGGER set_updated_at_feed_board_items BEFORE UPDATE ON public.feed_board_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER log_feed_board_created AFTER INSERT ON public.feed_boards FOR EACH ROW EXECUTE FUNCTION app_log_feed_board_created();

CREATE TRIGGER set_updated_at_feed_boards BEFORE UPDATE ON public.feed_boards FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_internal_messages_updated_at BEFORE UPDATE ON public.internal_messages FOR EACH ROW EXECUTE FUNCTION set_internal_messages_updated_at();

CREATE TRIGGER trg_pauta_members_touch_updated_at BEFORE UPDATE ON public.pauta_members FOR EACH ROW EXECUTE FUNCTION touch_pauta_members_updated_at();

CREATE TRIGGER trg_pautas_touch_updated_at BEFORE UPDATE ON public.pautas FOR EACH ROW EXECUTE FUNCTION touch_pautas_updated_at();

CREATE TRIGGER trg_touch_project_step_statuses_updated_at BEFORE UPDATE ON public.project_step_statuses FOR EACH ROW EXECUTE FUNCTION touch_project_step_statuses_updated_at();

CREATE TRIGGER set_updated_at_project_steps BEFORE UPDATE ON public.project_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_projects BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_team_members_updated_at BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION set_team_members_updated_at();

CREATE TRIGGER work_item_board_assignments_recalculate_trg AFTER INSERT OR DELETE OR UPDATE ON public.work_item_board_assignments FOR EACH ROW EXECUTE FUNCTION v8_assignment_after_change();

CREATE TRIGGER work_item_board_assignments_simple_card_trg BEFORE INSERT OR UPDATE OF metadata ON public.work_item_board_assignments FOR EACH ROW EXECUTE FUNCTION v9_prepare_simple_assignment_card();

CREATE TRIGGER guard_active_pauta_work_item_requires_pauta BEFORE INSERT OR UPDATE OF board_id, pauta_id, status ON public.work_items FOR EACH ROW EXECUTE FUNCTION guard_active_pauta_work_item_requires_pauta();

CREATE TRIGGER set_updated_at_work_items BEFORE UPDATE ON public.work_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_seed_project_step_statuses AFTER INSERT OR UPDATE OF destino ON public.work_items FOR EACH ROW EXECUTE FUNCTION seed_project_step_statuses_for_work_item();

CREATE TRIGGER validate_work_item_links BEFORE INSERT OR UPDATE OF client_id, client_service_id ON public.work_items FOR EACH ROW EXECUTE FUNCTION app_validate_work_item_links();

CREATE TRIGGER work_items_sync_assignment_trg AFTER INSERT OR UPDATE OF board_id, board_column_id, status, completed_at, completed_by, pauta_id ON public.work_items FOR EACH ROW EXECUTE FUNCTION v8_sync_assignment_from_work_item();

create policy "authenticated_read_profiles" on public."profiles" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "authenticated_all_projects" on public."projects" as PERMISSIVE for ALL to "authenticated" using (true);

create policy "authenticated_all_comments" on public."work_item_comments" as PERMISSIVE for ALL to "authenticated" using (true);

create policy "authenticated_read_history" on public."work_item_history" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "authenticated_all_checklists" on public."work_item_checklists" as PERMISSIVE for ALL to "authenticated" using (true);

create policy "authenticated_all_approvals" on public."approvals" as PERMISSIVE for ALL to "authenticated" using (true);

create policy "authenticated_all_blockers" on public."blockers" as PERMISSIVE for ALL to "authenticated" using (true);

create policy "authenticated_all_resource_links" on public."resource_links" as PERMISSIVE for ALL to "authenticated" using (true);

create policy "authenticated_read_audit_logs" on public."audit_logs" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "authenticated_all_chat" on public."chat_messages" as PERMISSIVE for ALL to "authenticated" using (true);

create policy "auth_all_feed" on public."feed_posts" as PERMISSIVE for ALL to "authenticated" using (true);

create policy "internal_messages_select_authenticated" on public."internal_messages" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "internal_messages_insert_authenticated" on public."internal_messages" as PERMISSIVE for INSERT to "authenticated" with check (true);

create policy "internal_messages_update_authenticated" on public."internal_messages" as PERMISSIVE for UPDATE to "authenticated" using (true) with check (true);

create policy "internal_message_mentions_select_authenticated" on public."internal_message_mentions" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "internal_message_mentions_insert_authenticated" on public."internal_message_mentions" as PERMISSIVE for INSERT to "authenticated" with check (true);

create policy "internal_message_mentions_update_authenticated" on public."internal_message_mentions" as PERMISSIVE for UPDATE to "authenticated" using (true) with check (true);

create policy "board_columns_insert_total" on public."board_columns" as PERMISSIVE for INSERT to "authenticated" with check (app_has_total_access());

create policy "board_columns_update_total" on public."board_columns" as PERMISSIVE for UPDATE to "authenticated" using (app_has_total_access()) with check (app_has_total_access());

create policy "board_columns_delete_total" on public."board_columns" as PERMISSIVE for DELETE to "authenticated" using (app_has_total_access());

create policy "project_step_statuses_select_authenticated" on public."project_step_statuses" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "project_step_statuses_insert_authenticated" on public."project_step_statuses" as PERMISSIVE for INSERT to "authenticated" with check (true);

create policy "project_step_statuses_update_authenticated" on public."project_step_statuses" as PERMISSIVE for UPDATE to "authenticated" using (true) with check (true);

create policy "project_step_statuses_delete_authenticated" on public."project_step_statuses" as PERMISSIVE for DELETE to "authenticated" using (true);

create policy "profiles_read_authenticated" on public."profiles" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "profiles_update_own" on public."profiles" as PERMISSIVE for UPDATE to "authenticated" using (((auth.uid() = id) AND app_is_active_user())) with check (((auth.uid() = id) AND app_is_active_user()));

create policy "profiles_manage_admin" on public."profiles" as PERMISSIVE for UPDATE to "authenticated" using (app_is_admin()) with check (app_is_admin());

create policy "clients_read_authenticated" on public."clients" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "clients_manage_managers" on public."clients" as PERMISSIVE for ALL to "authenticated" using (app_is_manager()) with check (app_is_manager());

create policy "services_read_authenticated" on public."service_catalog" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "services_manage_managers" on public."service_catalog" as PERMISSIVE for ALL to "authenticated" using (app_is_manager()) with check (app_is_manager());

create policy "client_services_read_authenticated" on public."client_services" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "client_services_manage_managers" on public."client_services" as PERMISSIVE for ALL to "authenticated" using (app_is_manager()) with check (app_is_manager());

create policy "demands_read_authenticated" on public."work_items" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "demands_create_authenticated" on public."work_items" as PERMISSIVE for INSERT to "authenticated" with check ((app_is_active_user() AND ((created_by = auth.uid()) OR (created_by IS NULL))));

create policy "feed_board_item_assets_authenticated_insert" on public."feed_board_item_assets" as PERMISSIVE for INSERT to "authenticated" with check (true);

create policy "feed_board_item_assets_authenticated_update" on public."feed_board_item_assets" as PERMISSIVE for UPDATE to "authenticated" using (true) with check (true);

create policy "feed_board_item_assets_authenticated_delete" on public."feed_board_item_assets" as PERMISSIVE for DELETE to "authenticated" using (true);

create policy "boards_select_authenticated" on public."boards" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "boards_insert_total" on public."boards" as PERMISSIVE for INSERT to "authenticated" with check (app_has_total_access());

create policy "boards_update_total" on public."boards" as PERMISSIVE for UPDATE to "authenticated" using (app_has_total_access()) with check (app_has_total_access());

create policy "boards_delete_total" on public."boards" as PERMISSIVE for DELETE to "authenticated" using (app_has_total_access());

create policy "board_columns_select_authenticated" on public."board_columns" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "demands_update_operational" on public."work_items" as PERMISSIVE for UPDATE to "authenticated" using ((app_is_manager() OR (app_is_active_user() AND ((responsible_id = auth.uid()) OR (created_by = auth.uid()))))) with check ((app_is_manager() OR (app_is_active_user() AND ((responsible_id = auth.uid()) OR (created_by = auth.uid())))));

create policy "demands_delete_managers" on public."work_items" as PERMISSIVE for DELETE to "authenticated" using (app_is_manager());

create policy "agenda_read_authenticated" on public."calendar_events" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "agenda_create_authenticated" on public."calendar_events" as PERMISSIVE for INSERT to "authenticated" with check ((app_is_active_user() AND ((created_by = auth.uid()) OR (created_by IS NULL))));

create policy "agenda_update_operational" on public."calendar_events" as PERMISSIVE for UPDATE to "authenticated" using ((app_is_manager() OR (app_is_active_user() AND ((responsible_id = auth.uid()) OR (created_by = auth.uid()))))) with check ((app_is_manager() OR (app_is_active_user() AND ((responsible_id = auth.uid()) OR (created_by = auth.uid())))));

create policy "agenda_delete_operational" on public."calendar_events" as PERMISSIVE for DELETE to "authenticated" using ((app_is_manager() OR (app_is_active_user() AND ((responsible_id = auth.uid()) OR (created_by = auth.uid())))));

create policy "steps_read_authenticated" on public."project_steps" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "avisos_select_authenticated" on public."avisos" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "avisos_insert_authenticated" on public."avisos" as PERMISSIVE for INSERT to "authenticated" with check (true);

create policy "avisos_update_authenticated" on public."avisos" as PERMISSIVE for UPDATE to "authenticated" using (true) with check (true);

create policy "avisos_delete_authenticated" on public."avisos" as PERMISSIVE for DELETE to "authenticated" using (true);

create policy "steps_operational" on public."project_steps" as PERMISSIVE for ALL to "authenticated" using ((app_is_manager() OR (EXISTS ( SELECT 1
   FROM work_items w
  WHERE ((w.id = project_steps.work_item_id) AND app_is_active_user() AND ((w.responsible_id = auth.uid()) OR (w.created_by = auth.uid()))))))) with check ((app_is_manager() OR (EXISTS ( SELECT 1
   FROM work_items w
  WHERE ((w.id = project_steps.work_item_id) AND app_is_active_user() AND ((w.responsible_id = auth.uid()) OR (w.created_by = auth.uid())))))));

create policy "history_read_authenticated" on public."work_item_history" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "history_insert_authenticated" on public."work_item_history" as PERMISSIVE for INSERT to "authenticated" with check ((app_is_active_user() AND ((actor_id = auth.uid()) OR (actor_id IS NULL))));

create policy "feed_boards_read_authenticated" on public."feed_boards" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "feed_boards_insert_authenticated" on public."feed_boards" as PERMISSIVE for INSERT to "authenticated" with check ((app_is_active_user() AND ((created_by = auth.uid()) OR (created_by IS NULL))));

create policy "feed_boards_update_authenticated" on public."feed_boards" as PERMISSIVE for UPDATE to "authenticated" using (app_is_active_user()) with check (app_is_active_user());

create policy "feed_boards_delete_managers" on public."feed_boards" as PERMISSIVE for DELETE to "authenticated" using (app_is_manager());

create policy "feed_board_items_read_authenticated" on public."feed_board_items" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "feed_board_items_insert_authenticated" on public."feed_board_items" as PERMISSIVE for INSERT to "authenticated" with check (app_is_active_user());

create policy "feed_board_items_update_authenticated" on public."feed_board_items" as PERMISSIVE for UPDATE to "authenticated" using (app_is_active_user()) with check (app_is_active_user());

create policy "feed_board_items_delete_authenticated" on public."feed_board_items" as PERMISSIVE for DELETE to "authenticated" using (app_is_active_user());

create policy "feed_board_events_read_authenticated" on public."feed_board_events" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "feed_board_events_insert_authenticated" on public."feed_board_events" as PERMISSIVE for INSERT to "authenticated" with check (app_is_active_user());

create policy "feed_board_events_delete_managers" on public."feed_board_events" as PERMISSIVE for DELETE to "authenticated" using (app_is_manager());

create policy "feed_board_item_assets_authenticated_select" on public."feed_board_item_assets" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "team_members_select_active" on public."team_members" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "team_members_insert_total" on public."team_members" as PERMISSIVE for INSERT to "authenticated" with check (has_total_access());

create policy "team_members_update_total" on public."team_members" as PERMISSIVE for UPDATE to "authenticated" using (has_total_access()) with check (has_total_access());

create policy "team_members_delete_total" on public."team_members" as PERMISSIVE for DELETE to "authenticated" using (has_total_access());

create policy "team_access_audit_select_total" on public."team_access_audit" as PERMISSIVE for SELECT to "authenticated" using (has_total_access());

create policy "team_access_audit_insert_total" on public."team_access_audit" as PERMISSIVE for INSERT to "authenticated" with check (has_total_access());

create policy "work_item_schedule_requirements_read_authenticated" on public."work_item_schedule_requirements" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "work_item_schedule_requirements_insert_authenticated" on public."work_item_schedule_requirements" as PERMISSIVE for INSERT to "authenticated" with check (app_is_active_user());

create policy "work_item_schedule_requirements_update_authenticated" on public."work_item_schedule_requirements" as PERMISSIVE for UPDATE to "authenticated" using (app_is_active_user()) with check (app_is_active_user());

create policy "work_item_schedule_requirements_delete_total" on public."work_item_schedule_requirements" as PERMISSIVE for DELETE to "authenticated" using (app_has_total_access());

create policy "pauta_members_select_active_users" on public."pauta_members" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "pauta_events_select_active_users" on public."pauta_events" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "pautas_select_active_users" on public."pautas" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "work_item_board_assignments_select_active" on public."work_item_board_assignments" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "work_item_board_assignment_events_select_active" on public."work_item_board_assignment_events" as PERMISSIVE for SELECT to "authenticated" using (app_is_active_user());

create policy "calendar_event_history_select_authenticated" on public."calendar_event_history" as PERMISSIVE for SELECT to "authenticated" using (true);

create view public."vw_meta_contas_financeiro" with (security_invoker=true) as  WITH agg AS (
         SELECT a.id AS ad_account_id,
            (COALESCE(sum(i.spend) FILTER (WHERE ((i.level = 'account'::text) AND (i.date_start >= (date_trunc('month'::text, timezone(COALESCE(a.timezone_name, 'America/Sao_Paulo'::text), now())))::date) AND (i.date_start <= (timezone(COALESCE(a.timezone_name, 'America/Sao_Paulo'::text), now()))::date))), (0)::numeric))::numeric(14,2) AS spend_month,
            (COALESCE(sum(i.spend) FILTER (WHERE ((i.level = 'account'::text) AND (i.date_start >= ((timezone(COALESCE(a.timezone_name, 'America/Sao_Paulo'::text), now()))::date - 6)) AND (i.date_start <= (timezone(COALESCE(a.timezone_name, 'America/Sao_Paulo'::text), now()))::date))), (0)::numeric))::numeric(14,2) AS spend_7d
           FROM (meta_ad_accounts a
             LEFT JOIN meta_insights_daily i ON ((i.ad_account_id = a.id)))
          GROUP BY a.id
        ), calc AS (
         SELECT a.id,
            a.client_id,
            a.meta_account_id,
            a.account_id,
            a.name,
            a.currency,
            a.timezone_name,
            a.account_status,
            a.is_selected,
            a.last_synced_at,
            a.created_at,
            a.updated_at,
            a.amount_spent_total,
            a.balance,
            a.spend_cap,
            a.is_prepay_account,
            a.billing_type,
            a.payment_method_label,
            a.funding_source_details,
            a.financial_synced_at,
            agg.spend_month,
            agg.spend_7d,
            round((agg.spend_7d / 7.0), 2) AS avg_daily_7d,
                CASE
                    WHEN (COALESCE(a.spend_cap, (0)::numeric) > (0)::numeric) THEN (GREATEST((a.spend_cap - COALESCE(a.amount_spent_total, (0)::numeric)), (0)::numeric))::numeric(14,2)
                    ELSE NULL::numeric
                END AS spend_cap_remaining
           FROM (meta_ad_accounts a
             JOIN agg ON ((agg.ad_account_id = a.id)))
        )
 SELECT id,
    meta_account_id,
    name,
    currency,
    account_status,
    is_selected,
    balance,
    amount_spent_total,
    spend_cap,
    spend_cap_remaining,
    is_prepay_account,
    billing_type,
    payment_method_label,
    financial_synced_at,
    spend_month,
    spend_7d,
    avg_daily_7d,
        CASE
            WHEN ((spend_cap_remaining IS NOT NULL) AND (avg_daily_7d > (0)::numeric)) THEN round((spend_cap_remaining / avg_daily_7d), 1)
            ELSE NULL::numeric
        END AS estimated_days_remaining,
        CASE
            WHEN ((spend_cap_remaining IS NOT NULL) AND (avg_daily_7d > (0)::numeric)) THEN ((timezone(COALESCE(timezone_name, 'America/Sao_Paulo'::text), now()))::date + (ceil((spend_cap_remaining / avg_daily_7d)))::integer)
            ELSE NULL::date
        END AS estimated_end_date,
        CASE
            WHEN (COALESCE(spend_cap, (0)::numeric) = (0)::numeric) THEN 'SEM LIMITE INFORMADO'::text
            WHEN (spend_cap_remaining <= (0)::numeric) THEN 'LIMITE ATINGIDO'::text
            WHEN (avg_daily_7d <= (0)::numeric) THEN 'SEM GASTO RECENTE'::text
            WHEN ((spend_cap_remaining / avg_daily_7d) < (3)::numeric) THEN 'CRITICO'::text
            WHEN ((spend_cap_remaining / avg_daily_7d) < (7)::numeric) THEN 'ATENCAO'::text
            ELSE 'OK'::text
        END AS financial_status
   FROM calc;

create view public."vw_meta_campanhas_dia" with (security_invoker=true) as  SELECT i.date_start AS dia,
    a.name AS conta,
    a.meta_account_id,
    a.client_id,
    i.entity_id AS meta_campaign_id,
    i.entity_name AS campanha,
    i.objective AS objetivo,
    i.spend AS investimento,
    i.impressions AS impressoes,
    i.reach AS alcance,
    i.frequency AS frequencia,
    i.clicks AS cliques,
    i.inline_link_clicks AS cliques_link,
    i.ctr,
    i.cpc,
    i.cpm,
    i.result_indicator AS tipo_resultado,
    i.result_count AS resultados,
        CASE
            WHEN (i.result_count > (0)::numeric) THEN round((i.spend / i.result_count), 2)
            ELSE NULL::numeric
        END AS custo_por_resultado
   FROM (meta_insights_daily i
     JOIN meta_ad_accounts a ON ((a.id = i.ad_account_id)))
  WHERE (i.level = 'campaign'::text);

create view public."vw_meta_contas_dia" with (security_invoker=true) as  SELECT i.date_start AS dia,
    a.name AS conta,
    a.meta_account_id,
    a.client_id,
    i.spend AS investimento,
    i.impressions AS impressoes,
    i.reach AS alcance,
    i.frequency AS frequencia,
    i.clicks AS cliques,
    i.inline_link_clicks AS cliques_link,
    i.ctr,
    i.cpc,
    i.cpm
   FROM (meta_insights_daily i
     JOIN meta_ad_accounts a ON ((a.id = i.ad_account_id)))
  WHERE (i.level = 'account'::text);

grant INSERT on table public."vw_meta_contas_financeiro" to "postgres";

grant SELECT on table public."vw_meta_contas_financeiro" to "postgres";

grant UPDATE on table public."vw_meta_contas_financeiro" to "postgres";

grant DELETE on table public."vw_meta_contas_financeiro" to "postgres";

grant TRUNCATE on table public."vw_meta_contas_financeiro" to "postgres";

grant REFERENCES on table public."vw_meta_contas_financeiro" to "postgres";

grant TRIGGER on table public."vw_meta_contas_financeiro" to "postgres";

grant INSERT on table public."vw_meta_contas_financeiro" to "service_role";

grant SELECT on table public."vw_meta_contas_financeiro" to "service_role";

grant UPDATE on table public."vw_meta_contas_financeiro" to "service_role";

grant DELETE on table public."vw_meta_contas_financeiro" to "service_role";

grant TRUNCATE on table public."vw_meta_contas_financeiro" to "service_role";

grant REFERENCES on table public."vw_meta_contas_financeiro" to "service_role";

grant TRIGGER on table public."vw_meta_contas_financeiro" to "service_role";

grant INSERT on table public."traffic_report_settings" to "postgres";

grant SELECT on table public."traffic_report_settings" to "postgres";

grant UPDATE on table public."traffic_report_settings" to "postgres";

grant DELETE on table public."traffic_report_settings" to "postgres";

grant TRUNCATE on table public."traffic_report_settings" to "postgres";

grant REFERENCES on table public."traffic_report_settings" to "postgres";

grant TRIGGER on table public."traffic_report_settings" to "postgres";

grant INSERT on table public."traffic_report_settings" to "anon";

grant SELECT on table public."traffic_report_settings" to "anon";

grant UPDATE on table public."traffic_report_settings" to "anon";

grant DELETE on table public."traffic_report_settings" to "anon";

grant TRUNCATE on table public."traffic_report_settings" to "anon";

grant REFERENCES on table public."traffic_report_settings" to "anon";

grant TRIGGER on table public."traffic_report_settings" to "anon";

grant INSERT on table public."traffic_report_settings" to "authenticated";

grant SELECT on table public."traffic_report_settings" to "authenticated";

grant UPDATE on table public."traffic_report_settings" to "authenticated";

grant DELETE on table public."traffic_report_settings" to "authenticated";

grant TRUNCATE on table public."traffic_report_settings" to "authenticated";

grant REFERENCES on table public."traffic_report_settings" to "authenticated";

grant TRIGGER on table public."traffic_report_settings" to "authenticated";

grant INSERT on table public."traffic_report_settings" to "service_role";

grant SELECT on table public."traffic_report_settings" to "service_role";

grant UPDATE on table public."traffic_report_settings" to "service_role";

grant DELETE on table public."traffic_report_settings" to "service_role";

grant TRUNCATE on table public."traffic_report_settings" to "service_role";

grant REFERENCES on table public."traffic_report_settings" to "service_role";

grant TRIGGER on table public."traffic_report_settings" to "service_role";

grant INSERT on table public."traffic_report_deliveries" to "postgres";

grant SELECT on table public."traffic_report_deliveries" to "postgres";

grant UPDATE on table public."traffic_report_deliveries" to "postgres";

grant DELETE on table public."traffic_report_deliveries" to "postgres";

grant TRUNCATE on table public."traffic_report_deliveries" to "postgres";

grant REFERENCES on table public."traffic_report_deliveries" to "postgres";

grant TRIGGER on table public."traffic_report_deliveries" to "postgres";

grant INSERT on table public."traffic_report_deliveries" to "anon";

grant SELECT on table public."traffic_report_deliveries" to "anon";

grant UPDATE on table public."traffic_report_deliveries" to "anon";

grant DELETE on table public."traffic_report_deliveries" to "anon";

grant TRUNCATE on table public."traffic_report_deliveries" to "anon";

grant REFERENCES on table public."traffic_report_deliveries" to "anon";

grant TRIGGER on table public."traffic_report_deliveries" to "anon";

grant INSERT on table public."traffic_report_deliveries" to "authenticated";

grant SELECT on table public."traffic_report_deliveries" to "authenticated";

grant UPDATE on table public."traffic_report_deliveries" to "authenticated";

grant DELETE on table public."traffic_report_deliveries" to "authenticated";

grant TRUNCATE on table public."traffic_report_deliveries" to "authenticated";

grant REFERENCES on table public."traffic_report_deliveries" to "authenticated";

grant TRIGGER on table public."traffic_report_deliveries" to "authenticated";

grant INSERT on table public."traffic_report_deliveries" to "service_role";

grant SELECT on table public."traffic_report_deliveries" to "service_role";

grant UPDATE on table public."traffic_report_deliveries" to "service_role";

grant DELETE on table public."traffic_report_deliveries" to "service_role";

grant TRUNCATE on table public."traffic_report_deliveries" to "service_role";

grant REFERENCES on table public."traffic_report_deliveries" to "service_role";

grant TRIGGER on table public."traffic_report_deliveries" to "service_role";

grant INSERT on table public."meta_period_insights" to "postgres";

grant SELECT on table public."meta_period_insights" to "postgres";

grant UPDATE on table public."meta_period_insights" to "postgres";

grant DELETE on table public."meta_period_insights" to "postgres";

grant TRUNCATE on table public."meta_period_insights" to "postgres";

grant REFERENCES on table public."meta_period_insights" to "postgres";

grant TRIGGER on table public."meta_period_insights" to "postgres";

grant INSERT on table public."meta_period_insights" to "anon";

grant SELECT on table public."meta_period_insights" to "anon";

grant UPDATE on table public."meta_period_insights" to "anon";

grant DELETE on table public."meta_period_insights" to "anon";

grant TRUNCATE on table public."meta_period_insights" to "anon";

grant REFERENCES on table public."meta_period_insights" to "anon";

grant TRIGGER on table public."meta_period_insights" to "anon";

grant INSERT on table public."meta_period_insights" to "authenticated";

grant SELECT on table public."meta_period_insights" to "authenticated";

grant UPDATE on table public."meta_period_insights" to "authenticated";

grant DELETE on table public."meta_period_insights" to "authenticated";

grant TRUNCATE on table public."meta_period_insights" to "authenticated";

grant REFERENCES on table public."meta_period_insights" to "authenticated";

grant TRIGGER on table public."meta_period_insights" to "authenticated";

grant INSERT on table public."meta_period_insights" to "service_role";

grant SELECT on table public."meta_period_insights" to "service_role";

grant UPDATE on table public."meta_period_insights" to "service_role";

grant DELETE on table public."meta_period_insights" to "service_role";

grant TRUNCATE on table public."meta_period_insights" to "service_role";

grant REFERENCES on table public."meta_period_insights" to "service_role";

grant TRIGGER on table public."meta_period_insights" to "service_role";

grant INSERT on table public."meta_ad_creatives" to "postgres";

grant SELECT on table public."meta_ad_creatives" to "postgres";

grant UPDATE on table public."meta_ad_creatives" to "postgres";

grant DELETE on table public."meta_ad_creatives" to "postgres";

grant TRUNCATE on table public."meta_ad_creatives" to "postgres";

grant REFERENCES on table public."meta_ad_creatives" to "postgres";

grant TRIGGER on table public."meta_ad_creatives" to "postgres";

grant INSERT on table public."meta_ad_creatives" to "anon";

grant SELECT on table public."meta_ad_creatives" to "anon";

grant UPDATE on table public."meta_ad_creatives" to "anon";

grant DELETE on table public."meta_ad_creatives" to "anon";

grant TRUNCATE on table public."meta_ad_creatives" to "anon";

grant REFERENCES on table public."meta_ad_creatives" to "anon";

grant TRIGGER on table public."meta_ad_creatives" to "anon";

grant INSERT on table public."meta_ad_creatives" to "authenticated";

grant SELECT on table public."meta_ad_creatives" to "authenticated";

grant UPDATE on table public."meta_ad_creatives" to "authenticated";

grant DELETE on table public."meta_ad_creatives" to "authenticated";

grant TRUNCATE on table public."meta_ad_creatives" to "authenticated";

grant REFERENCES on table public."meta_ad_creatives" to "authenticated";

grant TRIGGER on table public."meta_ad_creatives" to "authenticated";

grant INSERT on table public."meta_ad_creatives" to "service_role";

grant SELECT on table public."meta_ad_creatives" to "service_role";

grant UPDATE on table public."meta_ad_creatives" to "service_role";

grant DELETE on table public."meta_ad_creatives" to "service_role";

grant TRUNCATE on table public."meta_ad_creatives" to "service_role";

grant REFERENCES on table public."meta_ad_creatives" to "service_role";

grant TRIGGER on table public."meta_ad_creatives" to "service_role";

grant INSERT on table public."traffic_report_clients" to "postgres";

grant SELECT on table public."traffic_report_clients" to "postgres";

grant UPDATE on table public."traffic_report_clients" to "postgres";

grant DELETE on table public."traffic_report_clients" to "postgres";

grant TRUNCATE on table public."traffic_report_clients" to "postgres";

grant REFERENCES on table public."traffic_report_clients" to "postgres";

grant TRIGGER on table public."traffic_report_clients" to "postgres";

grant INSERT on table public."traffic_report_clients" to "anon";

grant SELECT on table public."traffic_report_clients" to "anon";

grant UPDATE on table public."traffic_report_clients" to "anon";

grant DELETE on table public."traffic_report_clients" to "anon";

grant TRUNCATE on table public."traffic_report_clients" to "anon";

grant REFERENCES on table public."traffic_report_clients" to "anon";

grant TRIGGER on table public."traffic_report_clients" to "anon";

grant INSERT on table public."traffic_report_clients" to "authenticated";

grant SELECT on table public."traffic_report_clients" to "authenticated";

grant UPDATE on table public."traffic_report_clients" to "authenticated";

grant DELETE on table public."traffic_report_clients" to "authenticated";

grant TRUNCATE on table public."traffic_report_clients" to "authenticated";

grant REFERENCES on table public."traffic_report_clients" to "authenticated";

grant TRIGGER on table public."traffic_report_clients" to "authenticated";

grant INSERT on table public."traffic_report_clients" to "service_role";

grant SELECT on table public."traffic_report_clients" to "service_role";

grant UPDATE on table public."traffic_report_clients" to "service_role";

grant DELETE on table public."traffic_report_clients" to "service_role";

grant TRUNCATE on table public."traffic_report_clients" to "service_role";

grant REFERENCES on table public."traffic_report_clients" to "service_role";

grant TRIGGER on table public."traffic_report_clients" to "service_role";

grant INSERT on table public."projects" to "postgres";

grant SELECT on table public."projects" to "postgres";

grant UPDATE on table public."projects" to "postgres";

grant DELETE on table public."projects" to "postgres";

grant TRUNCATE on table public."projects" to "postgres";

grant REFERENCES on table public."projects" to "postgres";

grant TRIGGER on table public."projects" to "postgres";

grant INSERT on table public."projects" to "anon";

grant SELECT on table public."projects" to "anon";

grant UPDATE on table public."projects" to "anon";

grant DELETE on table public."projects" to "anon";

grant TRUNCATE on table public."projects" to "anon";

grant REFERENCES on table public."projects" to "anon";

grant TRIGGER on table public."projects" to "anon";

grant INSERT on table public."projects" to "authenticated";

grant SELECT on table public."projects" to "authenticated";

grant UPDATE on table public."projects" to "authenticated";

grant DELETE on table public."projects" to "authenticated";

grant TRUNCATE on table public."projects" to "authenticated";

grant REFERENCES on table public."projects" to "authenticated";

grant TRIGGER on table public."projects" to "authenticated";

grant INSERT on table public."projects" to "service_role";

grant SELECT on table public."projects" to "service_role";

grant UPDATE on table public."projects" to "service_role";

grant DELETE on table public."projects" to "service_role";

grant TRUNCATE on table public."projects" to "service_role";

grant REFERENCES on table public."projects" to "service_role";

grant TRIGGER on table public."projects" to "service_role";

grant INSERT on table public."work_item_comments" to "postgres";

grant SELECT on table public."work_item_comments" to "postgres";

grant UPDATE on table public."work_item_comments" to "postgres";

grant DELETE on table public."work_item_comments" to "postgres";

grant TRUNCATE on table public."work_item_comments" to "postgres";

grant REFERENCES on table public."work_item_comments" to "postgres";

grant TRIGGER on table public."work_item_comments" to "postgres";

grant INSERT on table public."work_item_comments" to "anon";

grant SELECT on table public."work_item_comments" to "anon";

grant UPDATE on table public."work_item_comments" to "anon";

grant DELETE on table public."work_item_comments" to "anon";

grant TRUNCATE on table public."work_item_comments" to "anon";

grant REFERENCES on table public."work_item_comments" to "anon";

grant TRIGGER on table public."work_item_comments" to "anon";

grant INSERT on table public."work_item_comments" to "authenticated";

grant SELECT on table public."work_item_comments" to "authenticated";

grant UPDATE on table public."work_item_comments" to "authenticated";

grant DELETE on table public."work_item_comments" to "authenticated";

grant TRUNCATE on table public."work_item_comments" to "authenticated";

grant REFERENCES on table public."work_item_comments" to "authenticated";

grant TRIGGER on table public."work_item_comments" to "authenticated";

grant INSERT on table public."work_item_comments" to "service_role";

grant SELECT on table public."work_item_comments" to "service_role";

grant UPDATE on table public."work_item_comments" to "service_role";

grant DELETE on table public."work_item_comments" to "service_role";

grant TRUNCATE on table public."work_item_comments" to "service_role";

grant REFERENCES on table public."work_item_comments" to "service_role";

grant TRIGGER on table public."work_item_comments" to "service_role";

grant INSERT on table public."work_item_checklists" to "postgres";

grant SELECT on table public."work_item_checklists" to "postgres";

grant UPDATE on table public."work_item_checklists" to "postgres";

grant DELETE on table public."work_item_checklists" to "postgres";

grant TRUNCATE on table public."work_item_checklists" to "postgres";

grant REFERENCES on table public."work_item_checklists" to "postgres";

grant TRIGGER on table public."work_item_checklists" to "postgres";

grant INSERT on table public."work_item_checklists" to "anon";

grant SELECT on table public."work_item_checklists" to "anon";

grant UPDATE on table public."work_item_checklists" to "anon";

grant DELETE on table public."work_item_checklists" to "anon";

grant TRUNCATE on table public."work_item_checklists" to "anon";

grant REFERENCES on table public."work_item_checklists" to "anon";

grant TRIGGER on table public."work_item_checklists" to "anon";

grant INSERT on table public."work_item_checklists" to "authenticated";

grant SELECT on table public."work_item_checklists" to "authenticated";

grant UPDATE on table public."work_item_checklists" to "authenticated";

grant DELETE on table public."work_item_checklists" to "authenticated";

grant TRUNCATE on table public."work_item_checklists" to "authenticated";

grant REFERENCES on table public."work_item_checklists" to "authenticated";

grant TRIGGER on table public."work_item_checklists" to "authenticated";

grant INSERT on table public."work_item_checklists" to "service_role";

grant SELECT on table public."work_item_checklists" to "service_role";

grant UPDATE on table public."work_item_checklists" to "service_role";

grant DELETE on table public."work_item_checklists" to "service_role";

grant TRUNCATE on table public."work_item_checklists" to "service_role";

grant REFERENCES on table public."work_item_checklists" to "service_role";

grant TRIGGER on table public."work_item_checklists" to "service_role";

grant INSERT on table public."approvals" to "postgres";

grant SELECT on table public."approvals" to "postgres";

grant UPDATE on table public."approvals" to "postgres";

grant DELETE on table public."approvals" to "postgres";

grant TRUNCATE on table public."approvals" to "postgres";

grant REFERENCES on table public."approvals" to "postgres";

grant TRIGGER on table public."approvals" to "postgres";

grant INSERT on table public."approvals" to "anon";

grant SELECT on table public."approvals" to "anon";

grant UPDATE on table public."approvals" to "anon";

grant DELETE on table public."approvals" to "anon";

grant TRUNCATE on table public."approvals" to "anon";

grant REFERENCES on table public."approvals" to "anon";

grant TRIGGER on table public."approvals" to "anon";

grant INSERT on table public."approvals" to "authenticated";

grant SELECT on table public."approvals" to "authenticated";

grant UPDATE on table public."approvals" to "authenticated";

grant DELETE on table public."approvals" to "authenticated";

grant TRUNCATE on table public."approvals" to "authenticated";

grant REFERENCES on table public."approvals" to "authenticated";

grant TRIGGER on table public."approvals" to "authenticated";

grant INSERT on table public."approvals" to "service_role";

grant SELECT on table public."approvals" to "service_role";

grant UPDATE on table public."approvals" to "service_role";

grant DELETE on table public."approvals" to "service_role";

grant TRUNCATE on table public."approvals" to "service_role";

grant REFERENCES on table public."approvals" to "service_role";

grant TRIGGER on table public."approvals" to "service_role";

grant INSERT on table public."blockers" to "postgres";

grant SELECT on table public."blockers" to "postgres";

grant UPDATE on table public."blockers" to "postgres";

grant DELETE on table public."blockers" to "postgres";

grant TRUNCATE on table public."blockers" to "postgres";

grant REFERENCES on table public."blockers" to "postgres";

grant TRIGGER on table public."blockers" to "postgres";

grant INSERT on table public."blockers" to "anon";

grant SELECT on table public."blockers" to "anon";

grant UPDATE on table public."blockers" to "anon";

grant DELETE on table public."blockers" to "anon";

grant TRUNCATE on table public."blockers" to "anon";

grant REFERENCES on table public."blockers" to "anon";

grant TRIGGER on table public."blockers" to "anon";

grant INSERT on table public."blockers" to "authenticated";

grant SELECT on table public."blockers" to "authenticated";

grant UPDATE on table public."blockers" to "authenticated";

grant DELETE on table public."blockers" to "authenticated";

grant TRUNCATE on table public."blockers" to "authenticated";

grant REFERENCES on table public."blockers" to "authenticated";

grant TRIGGER on table public."blockers" to "authenticated";

grant INSERT on table public."blockers" to "service_role";

grant SELECT on table public."blockers" to "service_role";

grant UPDATE on table public."blockers" to "service_role";

grant DELETE on table public."blockers" to "service_role";

grant TRUNCATE on table public."blockers" to "service_role";

grant REFERENCES on table public."blockers" to "service_role";

grant TRIGGER on table public."blockers" to "service_role";

grant INSERT on table public."resource_links" to "postgres";

grant SELECT on table public."resource_links" to "postgres";

grant UPDATE on table public."resource_links" to "postgres";

grant DELETE on table public."resource_links" to "postgres";

grant TRUNCATE on table public."resource_links" to "postgres";

grant REFERENCES on table public."resource_links" to "postgres";

grant TRIGGER on table public."resource_links" to "postgres";

grant INSERT on table public."resource_links" to "anon";

grant SELECT on table public."resource_links" to "anon";

grant UPDATE on table public."resource_links" to "anon";

grant DELETE on table public."resource_links" to "anon";

grant TRUNCATE on table public."resource_links" to "anon";

grant REFERENCES on table public."resource_links" to "anon";

grant TRIGGER on table public."resource_links" to "anon";

grant INSERT on table public."resource_links" to "authenticated";

grant SELECT on table public."resource_links" to "authenticated";

grant UPDATE on table public."resource_links" to "authenticated";

grant DELETE on table public."resource_links" to "authenticated";

grant TRUNCATE on table public."resource_links" to "authenticated";

grant REFERENCES on table public."resource_links" to "authenticated";

grant TRIGGER on table public."resource_links" to "authenticated";

grant INSERT on table public."resource_links" to "service_role";

grant SELECT on table public."resource_links" to "service_role";

grant UPDATE on table public."resource_links" to "service_role";

grant DELETE on table public."resource_links" to "service_role";

grant TRUNCATE on table public."resource_links" to "service_role";

grant REFERENCES on table public."resource_links" to "service_role";

grant TRIGGER on table public."resource_links" to "service_role";

grant INSERT on table public."audit_logs" to "postgres";

grant SELECT on table public."audit_logs" to "postgres";

grant UPDATE on table public."audit_logs" to "postgres";

grant DELETE on table public."audit_logs" to "postgres";

grant TRUNCATE on table public."audit_logs" to "postgres";

grant REFERENCES on table public."audit_logs" to "postgres";

grant TRIGGER on table public."audit_logs" to "postgres";

grant INSERT on table public."audit_logs" to "anon";

grant SELECT on table public."audit_logs" to "anon";

grant UPDATE on table public."audit_logs" to "anon";

grant DELETE on table public."audit_logs" to "anon";

grant TRUNCATE on table public."audit_logs" to "anon";

grant REFERENCES on table public."audit_logs" to "anon";

grant TRIGGER on table public."audit_logs" to "anon";

grant INSERT on table public."audit_logs" to "authenticated";

grant SELECT on table public."audit_logs" to "authenticated";

grant UPDATE on table public."audit_logs" to "authenticated";

grant DELETE on table public."audit_logs" to "authenticated";

grant TRUNCATE on table public."audit_logs" to "authenticated";

grant REFERENCES on table public."audit_logs" to "authenticated";

grant TRIGGER on table public."audit_logs" to "authenticated";

grant INSERT on table public."audit_logs" to "service_role";

grant SELECT on table public."audit_logs" to "service_role";

grant UPDATE on table public."audit_logs" to "service_role";

grant DELETE on table public."audit_logs" to "service_role";

grant TRUNCATE on table public."audit_logs" to "service_role";

grant REFERENCES on table public."audit_logs" to "service_role";

grant TRIGGER on table public."audit_logs" to "service_role";

grant INSERT on table public."chat_messages" to "postgres";

grant SELECT on table public."chat_messages" to "postgres";

grant UPDATE on table public."chat_messages" to "postgres";

grant DELETE on table public."chat_messages" to "postgres";

grant TRUNCATE on table public."chat_messages" to "postgres";

grant REFERENCES on table public."chat_messages" to "postgres";

grant TRIGGER on table public."chat_messages" to "postgres";

grant INSERT on table public."chat_messages" to "anon";

grant SELECT on table public."chat_messages" to "anon";

grant UPDATE on table public."chat_messages" to "anon";

grant DELETE on table public."chat_messages" to "anon";

grant TRUNCATE on table public."chat_messages" to "anon";

grant REFERENCES on table public."chat_messages" to "anon";

grant TRIGGER on table public."chat_messages" to "anon";

grant INSERT on table public."chat_messages" to "authenticated";

grant SELECT on table public."chat_messages" to "authenticated";

grant UPDATE on table public."chat_messages" to "authenticated";

grant DELETE on table public."chat_messages" to "authenticated";

grant TRUNCATE on table public."chat_messages" to "authenticated";

grant REFERENCES on table public."chat_messages" to "authenticated";

grant TRIGGER on table public."chat_messages" to "authenticated";

grant INSERT on table public."chat_messages" to "service_role";

grant SELECT on table public."chat_messages" to "service_role";

grant UPDATE on table public."chat_messages" to "service_role";

grant DELETE on table public."chat_messages" to "service_role";

grant TRUNCATE on table public."chat_messages" to "service_role";

grant REFERENCES on table public."chat_messages" to "service_role";

grant TRIGGER on table public."chat_messages" to "service_role";

grant INSERT on table public."comercial_config" to "postgres";

grant SELECT on table public."comercial_config" to "postgres";

grant UPDATE on table public."comercial_config" to "postgres";

grant DELETE on table public."comercial_config" to "postgres";

grant TRUNCATE on table public."comercial_config" to "postgres";

grant REFERENCES on table public."comercial_config" to "postgres";

grant TRIGGER on table public."comercial_config" to "postgres";

grant INSERT on table public."comercial_config" to "anon";

grant SELECT on table public."comercial_config" to "anon";

grant UPDATE on table public."comercial_config" to "anon";

grant DELETE on table public."comercial_config" to "anon";

grant TRUNCATE on table public."comercial_config" to "anon";

grant REFERENCES on table public."comercial_config" to "anon";

grant TRIGGER on table public."comercial_config" to "anon";

grant INSERT on table public."comercial_config" to "authenticated";

grant SELECT on table public."comercial_config" to "authenticated";

grant UPDATE on table public."comercial_config" to "authenticated";

grant DELETE on table public."comercial_config" to "authenticated";

grant TRUNCATE on table public."comercial_config" to "authenticated";

grant REFERENCES on table public."comercial_config" to "authenticated";

grant TRIGGER on table public."comercial_config" to "authenticated";

grant INSERT on table public."comercial_config" to "service_role";

grant SELECT on table public."comercial_config" to "service_role";

grant UPDATE on table public."comercial_config" to "service_role";

grant DELETE on table public."comercial_config" to "service_role";

grant TRUNCATE on table public."comercial_config" to "service_role";

grant REFERENCES on table public."comercial_config" to "service_role";

grant TRIGGER on table public."comercial_config" to "service_role";

grant INSERT on table public."comercial_reunioes" to "postgres";

grant SELECT on table public."comercial_reunioes" to "postgres";

grant UPDATE on table public."comercial_reunioes" to "postgres";

grant DELETE on table public."comercial_reunioes" to "postgres";

grant TRUNCATE on table public."comercial_reunioes" to "postgres";

grant REFERENCES on table public."comercial_reunioes" to "postgres";

grant TRIGGER on table public."comercial_reunioes" to "postgres";

grant INSERT on table public."comercial_reunioes" to "anon";

grant SELECT on table public."comercial_reunioes" to "anon";

grant UPDATE on table public."comercial_reunioes" to "anon";

grant DELETE on table public."comercial_reunioes" to "anon";

grant TRUNCATE on table public."comercial_reunioes" to "anon";

grant REFERENCES on table public."comercial_reunioes" to "anon";

grant TRIGGER on table public."comercial_reunioes" to "anon";

grant INSERT on table public."comercial_reunioes" to "authenticated";

grant SELECT on table public."comercial_reunioes" to "authenticated";

grant UPDATE on table public."comercial_reunioes" to "authenticated";

grant DELETE on table public."comercial_reunioes" to "authenticated";

grant TRUNCATE on table public."comercial_reunioes" to "authenticated";

grant REFERENCES on table public."comercial_reunioes" to "authenticated";

grant TRIGGER on table public."comercial_reunioes" to "authenticated";

grant INSERT on table public."comercial_reunioes" to "service_role";

grant SELECT on table public."comercial_reunioes" to "service_role";

grant UPDATE on table public."comercial_reunioes" to "service_role";

grant DELETE on table public."comercial_reunioes" to "service_role";

grant TRUNCATE on table public."comercial_reunioes" to "service_role";

grant REFERENCES on table public."comercial_reunioes" to "service_role";

grant TRIGGER on table public."comercial_reunioes" to "service_role";

grant INSERT on table public."comercial_leads" to "postgres";

grant SELECT on table public."comercial_leads" to "postgres";

grant UPDATE on table public."comercial_leads" to "postgres";

grant DELETE on table public."comercial_leads" to "postgres";

grant TRUNCATE on table public."comercial_leads" to "postgres";

grant REFERENCES on table public."comercial_leads" to "postgres";

grant TRIGGER on table public."comercial_leads" to "postgres";

grant INSERT on table public."comercial_leads" to "anon";

grant SELECT on table public."comercial_leads" to "anon";

grant UPDATE on table public."comercial_leads" to "anon";

grant DELETE on table public."comercial_leads" to "anon";

grant TRUNCATE on table public."comercial_leads" to "anon";

grant REFERENCES on table public."comercial_leads" to "anon";

grant TRIGGER on table public."comercial_leads" to "anon";

grant INSERT on table public."comercial_leads" to "authenticated";

grant SELECT on table public."comercial_leads" to "authenticated";

grant UPDATE on table public."comercial_leads" to "authenticated";

grant DELETE on table public."comercial_leads" to "authenticated";

grant TRUNCATE on table public."comercial_leads" to "authenticated";

grant REFERENCES on table public."comercial_leads" to "authenticated";

grant TRIGGER on table public."comercial_leads" to "authenticated";

grant INSERT on table public."comercial_leads" to "service_role";

grant SELECT on table public."comercial_leads" to "service_role";

grant UPDATE on table public."comercial_leads" to "service_role";

grant DELETE on table public."comercial_leads" to "service_role";

grant TRUNCATE on table public."comercial_leads" to "service_role";

grant REFERENCES on table public."comercial_leads" to "service_role";

grant TRIGGER on table public."comercial_leads" to "service_role";

grant INSERT on table public."feed_posts" to "postgres";

grant SELECT on table public."feed_posts" to "postgres";

grant UPDATE on table public."feed_posts" to "postgres";

grant DELETE on table public."feed_posts" to "postgres";

grant TRUNCATE on table public."feed_posts" to "postgres";

grant REFERENCES on table public."feed_posts" to "postgres";

grant TRIGGER on table public."feed_posts" to "postgres";

grant INSERT on table public."feed_posts" to "anon";

grant SELECT on table public."feed_posts" to "anon";

grant UPDATE on table public."feed_posts" to "anon";

grant DELETE on table public."feed_posts" to "anon";

grant TRUNCATE on table public."feed_posts" to "anon";

grant REFERENCES on table public."feed_posts" to "anon";

grant TRIGGER on table public."feed_posts" to "anon";

grant INSERT on table public."feed_posts" to "authenticated";

grant SELECT on table public."feed_posts" to "authenticated";

grant UPDATE on table public."feed_posts" to "authenticated";

grant DELETE on table public."feed_posts" to "authenticated";

grant TRUNCATE on table public."feed_posts" to "authenticated";

grant REFERENCES on table public."feed_posts" to "authenticated";

grant TRIGGER on table public."feed_posts" to "authenticated";

grant INSERT on table public."feed_posts" to "service_role";

grant SELECT on table public."feed_posts" to "service_role";

grant UPDATE on table public."feed_posts" to "service_role";

grant DELETE on table public."feed_posts" to "service_role";

grant TRUNCATE on table public."feed_posts" to "service_role";

grant REFERENCES on table public."feed_posts" to "service_role";

grant TRIGGER on table public."feed_posts" to "service_role";

grant INSERT on table public."comercial_mensagens" to "postgres";

grant SELECT on table public."comercial_mensagens" to "postgres";

grant UPDATE on table public."comercial_mensagens" to "postgres";

grant DELETE on table public."comercial_mensagens" to "postgres";

grant TRUNCATE on table public."comercial_mensagens" to "postgres";

grant REFERENCES on table public."comercial_mensagens" to "postgres";

grant TRIGGER on table public."comercial_mensagens" to "postgres";

grant INSERT on table public."comercial_mensagens" to "service_role";

grant SELECT on table public."comercial_mensagens" to "service_role";

grant UPDATE on table public."comercial_mensagens" to "service_role";

grant DELETE on table public."comercial_mensagens" to "service_role";

grant TRUNCATE on table public."comercial_mensagens" to "service_role";

grant REFERENCES on table public."comercial_mensagens" to "service_role";

grant TRIGGER on table public."comercial_mensagens" to "service_role";

grant INSERT on table public."comercial_formularios" to "postgres";

grant SELECT on table public."comercial_formularios" to "postgres";

grant UPDATE on table public."comercial_formularios" to "postgres";

grant DELETE on table public."comercial_formularios" to "postgres";

grant TRUNCATE on table public."comercial_formularios" to "postgres";

grant REFERENCES on table public."comercial_formularios" to "postgres";

grant TRIGGER on table public."comercial_formularios" to "postgres";

grant INSERT on table public."comercial_formularios" to "service_role";

grant SELECT on table public."comercial_formularios" to "service_role";

grant UPDATE on table public."comercial_formularios" to "service_role";

grant DELETE on table public."comercial_formularios" to "service_role";

grant TRUNCATE on table public."comercial_formularios" to "service_role";

grant REFERENCES on table public."comercial_formularios" to "service_role";

grant TRIGGER on table public."comercial_formularios" to "service_role";

grant INSERT on table public."project_steps" to "postgres";

grant SELECT on table public."project_steps" to "postgres";

grant UPDATE on table public."project_steps" to "postgres";

grant DELETE on table public."project_steps" to "postgres";

grant TRUNCATE on table public."project_steps" to "postgres";

grant REFERENCES on table public."project_steps" to "postgres";

grant TRIGGER on table public."project_steps" to "postgres";

grant INSERT on table public."project_steps" to "anon";

grant SELECT on table public."project_steps" to "anon";

grant UPDATE on table public."project_steps" to "anon";

grant DELETE on table public."project_steps" to "anon";

grant TRUNCATE on table public."project_steps" to "anon";

grant REFERENCES on table public."project_steps" to "anon";

grant TRIGGER on table public."project_steps" to "anon";

grant INSERT on table public."project_steps" to "authenticated";

grant SELECT on table public."project_steps" to "authenticated";

grant UPDATE on table public."project_steps" to "authenticated";

grant DELETE on table public."project_steps" to "authenticated";

grant TRUNCATE on table public."project_steps" to "authenticated";

grant REFERENCES on table public."project_steps" to "authenticated";

grant TRIGGER on table public."project_steps" to "authenticated";

grant INSERT on table public."project_steps" to "service_role";

grant SELECT on table public."project_steps" to "service_role";

grant UPDATE on table public."project_steps" to "service_role";

grant DELETE on table public."project_steps" to "service_role";

grant TRUNCATE on table public."project_steps" to "service_role";

grant REFERENCES on table public."project_steps" to "service_role";

grant TRIGGER on table public."project_steps" to "service_role";

grant INSERT on table public."profiles" to "postgres";

grant SELECT on table public."profiles" to "postgres";

grant UPDATE on table public."profiles" to "postgres";

grant DELETE on table public."profiles" to "postgres";

grant TRUNCATE on table public."profiles" to "postgres";

grant REFERENCES on table public."profiles" to "postgres";

grant TRIGGER on table public."profiles" to "postgres";

grant INSERT on table public."profiles" to "anon";

grant SELECT on table public."profiles" to "anon";

grant UPDATE on table public."profiles" to "anon";

grant DELETE on table public."profiles" to "anon";

grant TRUNCATE on table public."profiles" to "anon";

grant REFERENCES on table public."profiles" to "anon";

grant TRIGGER on table public."profiles" to "anon";

grant INSERT on table public."profiles" to "authenticated";

grant SELECT on table public."profiles" to "authenticated";

grant UPDATE on table public."profiles" to "authenticated";

grant DELETE on table public."profiles" to "authenticated";

grant TRUNCATE on table public."profiles" to "authenticated";

grant REFERENCES on table public."profiles" to "authenticated";

grant TRIGGER on table public."profiles" to "authenticated";

grant INSERT on table public."profiles" to "service_role";

grant SELECT on table public."profiles" to "service_role";

grant UPDATE on table public."profiles" to "service_role";

grant DELETE on table public."profiles" to "service_role";

grant TRUNCATE on table public."profiles" to "service_role";

grant REFERENCES on table public."profiles" to "service_role";

grant TRIGGER on table public."profiles" to "service_role";

grant INSERT on table public."work_item_history" to "postgres";

grant SELECT on table public."work_item_history" to "postgres";

grant UPDATE on table public."work_item_history" to "postgres";

grant DELETE on table public."work_item_history" to "postgres";

grant TRUNCATE on table public."work_item_history" to "postgres";

grant REFERENCES on table public."work_item_history" to "postgres";

grant TRIGGER on table public."work_item_history" to "postgres";

grant INSERT on table public."work_item_history" to "anon";

grant SELECT on table public."work_item_history" to "anon";

grant UPDATE on table public."work_item_history" to "anon";

grant DELETE on table public."work_item_history" to "anon";

grant TRUNCATE on table public."work_item_history" to "anon";

grant REFERENCES on table public."work_item_history" to "anon";

grant TRIGGER on table public."work_item_history" to "anon";

grant INSERT on table public."work_item_history" to "authenticated";

grant SELECT on table public."work_item_history" to "authenticated";

grant UPDATE on table public."work_item_history" to "authenticated";

grant DELETE on table public."work_item_history" to "authenticated";

grant TRUNCATE on table public."work_item_history" to "authenticated";

grant REFERENCES on table public."work_item_history" to "authenticated";

grant TRIGGER on table public."work_item_history" to "authenticated";

grant INSERT on table public."work_item_history" to "service_role";

grant SELECT on table public."work_item_history" to "service_role";

grant UPDATE on table public."work_item_history" to "service_role";

grant DELETE on table public."work_item_history" to "service_role";

grant TRUNCATE on table public."work_item_history" to "service_role";

grant REFERENCES on table public."work_item_history" to "service_role";

grant TRIGGER on table public."work_item_history" to "service_role";

grant INSERT on table public."service_catalog" to "postgres";

grant SELECT on table public."service_catalog" to "postgres";

grant UPDATE on table public."service_catalog" to "postgres";

grant DELETE on table public."service_catalog" to "postgres";

grant TRUNCATE on table public."service_catalog" to "postgres";

grant REFERENCES on table public."service_catalog" to "postgres";

grant TRIGGER on table public."service_catalog" to "postgres";

grant INSERT on table public."service_catalog" to "anon";

grant SELECT on table public."service_catalog" to "anon";

grant UPDATE on table public."service_catalog" to "anon";

grant DELETE on table public."service_catalog" to "anon";

grant TRUNCATE on table public."service_catalog" to "anon";

grant REFERENCES on table public."service_catalog" to "anon";

grant TRIGGER on table public."service_catalog" to "anon";

grant INSERT on table public."service_catalog" to "authenticated";

grant SELECT on table public."service_catalog" to "authenticated";

grant UPDATE on table public."service_catalog" to "authenticated";

grant DELETE on table public."service_catalog" to "authenticated";

grant TRUNCATE on table public."service_catalog" to "authenticated";

grant REFERENCES on table public."service_catalog" to "authenticated";

grant TRIGGER on table public."service_catalog" to "authenticated";

grant INSERT on table public."service_catalog" to "service_role";

grant SELECT on table public."service_catalog" to "service_role";

grant UPDATE on table public."service_catalog" to "service_role";

grant DELETE on table public."service_catalog" to "service_role";

grant TRUNCATE on table public."service_catalog" to "service_role";

grant REFERENCES on table public."service_catalog" to "service_role";

grant TRIGGER on table public."service_catalog" to "service_role";

grant INSERT on table public."calendar_events" to "postgres";

grant SELECT on table public."calendar_events" to "postgres";

grant UPDATE on table public."calendar_events" to "postgres";

grant DELETE on table public."calendar_events" to "postgres";

grant TRUNCATE on table public."calendar_events" to "postgres";

grant REFERENCES on table public."calendar_events" to "postgres";

grant TRIGGER on table public."calendar_events" to "postgres";

grant INSERT on table public."calendar_events" to "anon";

grant SELECT on table public."calendar_events" to "anon";

grant UPDATE on table public."calendar_events" to "anon";

grant DELETE on table public."calendar_events" to "anon";

grant TRUNCATE on table public."calendar_events" to "anon";

grant REFERENCES on table public."calendar_events" to "anon";

grant TRIGGER on table public."calendar_events" to "anon";

grant INSERT on table public."calendar_events" to "authenticated";

grant SELECT on table public."calendar_events" to "authenticated";

grant UPDATE on table public."calendar_events" to "authenticated";

grant DELETE on table public."calendar_events" to "authenticated";

grant TRUNCATE on table public."calendar_events" to "authenticated";

grant REFERENCES on table public."calendar_events" to "authenticated";

grant TRIGGER on table public."calendar_events" to "authenticated";

grant INSERT on table public."calendar_events" to "service_role";

grant SELECT on table public."calendar_events" to "service_role";

grant UPDATE on table public."calendar_events" to "service_role";

grant DELETE on table public."calendar_events" to "service_role";

grant TRUNCATE on table public."calendar_events" to "service_role";

grant REFERENCES on table public."calendar_events" to "service_role";

grant TRIGGER on table public."calendar_events" to "service_role";

grant INSERT on table public."clients" to "postgres";

grant SELECT on table public."clients" to "postgres";

grant UPDATE on table public."clients" to "postgres";

grant DELETE on table public."clients" to "postgres";

grant TRUNCATE on table public."clients" to "postgres";

grant REFERENCES on table public."clients" to "postgres";

grant TRIGGER on table public."clients" to "postgres";

grant INSERT on table public."clients" to "anon";

grant SELECT on table public."clients" to "anon";

grant UPDATE on table public."clients" to "anon";

grant DELETE on table public."clients" to "anon";

grant TRUNCATE on table public."clients" to "anon";

grant REFERENCES on table public."clients" to "anon";

grant TRIGGER on table public."clients" to "anon";

grant INSERT on table public."clients" to "authenticated";

grant SELECT on table public."clients" to "authenticated";

grant UPDATE on table public."clients" to "authenticated";

grant DELETE on table public."clients" to "authenticated";

grant TRUNCATE on table public."clients" to "authenticated";

grant REFERENCES on table public."clients" to "authenticated";

grant TRIGGER on table public."clients" to "authenticated";

grant INSERT on table public."clients" to "service_role";

grant SELECT on table public."clients" to "service_role";

grant UPDATE on table public."clients" to "service_role";

grant DELETE on table public."clients" to "service_role";

grant TRUNCATE on table public."clients" to "service_role";

grant REFERENCES on table public."clients" to "service_role";

grant TRIGGER on table public."clients" to "service_role";

grant INSERT on table public."client_services" to "postgres";

grant SELECT on table public."client_services" to "postgres";

grant UPDATE on table public."client_services" to "postgres";

grant DELETE on table public."client_services" to "postgres";

grant TRUNCATE on table public."client_services" to "postgres";

grant REFERENCES on table public."client_services" to "postgres";

grant TRIGGER on table public."client_services" to "postgres";

grant INSERT on table public."client_services" to "anon";

grant SELECT on table public."client_services" to "anon";

grant UPDATE on table public."client_services" to "anon";

grant DELETE on table public."client_services" to "anon";

grant TRUNCATE on table public."client_services" to "anon";

grant REFERENCES on table public."client_services" to "anon";

grant TRIGGER on table public."client_services" to "anon";

grant INSERT on table public."client_services" to "authenticated";

grant SELECT on table public."client_services" to "authenticated";

grant UPDATE on table public."client_services" to "authenticated";

grant DELETE on table public."client_services" to "authenticated";

grant TRUNCATE on table public."client_services" to "authenticated";

grant REFERENCES on table public."client_services" to "authenticated";

grant TRIGGER on table public."client_services" to "authenticated";

grant INSERT on table public."client_services" to "service_role";

grant SELECT on table public."client_services" to "service_role";

grant UPDATE on table public."client_services" to "service_role";

grant DELETE on table public."client_services" to "service_role";

grant TRUNCATE on table public."client_services" to "service_role";

grant REFERENCES on table public."client_services" to "service_role";

grant TRIGGER on table public."client_services" to "service_role";

grant INSERT on table public."feed_board_events" to "postgres";

grant SELECT on table public."feed_board_events" to "postgres";

grant UPDATE on table public."feed_board_events" to "postgres";

grant DELETE on table public."feed_board_events" to "postgres";

grant TRUNCATE on table public."feed_board_events" to "postgres";

grant REFERENCES on table public."feed_board_events" to "postgres";

grant TRIGGER on table public."feed_board_events" to "postgres";

grant INSERT on table public."feed_board_events" to "anon";

grant SELECT on table public."feed_board_events" to "anon";

grant UPDATE on table public."feed_board_events" to "anon";

grant DELETE on table public."feed_board_events" to "anon";

grant TRUNCATE on table public."feed_board_events" to "anon";

grant REFERENCES on table public."feed_board_events" to "anon";

grant TRIGGER on table public."feed_board_events" to "anon";

grant INSERT on table public."feed_board_events" to "authenticated";

grant SELECT on table public."feed_board_events" to "authenticated";

grant UPDATE on table public."feed_board_events" to "authenticated";

grant DELETE on table public."feed_board_events" to "authenticated";

grant TRUNCATE on table public."feed_board_events" to "authenticated";

grant REFERENCES on table public."feed_board_events" to "authenticated";

grant TRIGGER on table public."feed_board_events" to "authenticated";

grant INSERT on table public."feed_board_events" to "service_role";

grant SELECT on table public."feed_board_events" to "service_role";

grant UPDATE on table public."feed_board_events" to "service_role";

grant DELETE on table public."feed_board_events" to "service_role";

grant TRUNCATE on table public."feed_board_events" to "service_role";

grant REFERENCES on table public."feed_board_events" to "service_role";

grant TRIGGER on table public."feed_board_events" to "service_role";

grant INSERT on table public."feed_boards" to "postgres";

grant SELECT on table public."feed_boards" to "postgres";

grant UPDATE on table public."feed_boards" to "postgres";

grant DELETE on table public."feed_boards" to "postgres";

grant TRUNCATE on table public."feed_boards" to "postgres";

grant REFERENCES on table public."feed_boards" to "postgres";

grant TRIGGER on table public."feed_boards" to "postgres";

grant INSERT on table public."feed_boards" to "anon";

grant SELECT on table public."feed_boards" to "anon";

grant UPDATE on table public."feed_boards" to "anon";

grant DELETE on table public."feed_boards" to "anon";

grant TRUNCATE on table public."feed_boards" to "anon";

grant REFERENCES on table public."feed_boards" to "anon";

grant TRIGGER on table public."feed_boards" to "anon";

grant INSERT on table public."feed_boards" to "authenticated";

grant SELECT on table public."feed_boards" to "authenticated";

grant UPDATE on table public."feed_boards" to "authenticated";

grant DELETE on table public."feed_boards" to "authenticated";

grant TRUNCATE on table public."feed_boards" to "authenticated";

grant REFERENCES on table public."feed_boards" to "authenticated";

grant TRIGGER on table public."feed_boards" to "authenticated";

grant INSERT on table public."feed_boards" to "service_role";

grant SELECT on table public."feed_boards" to "service_role";

grant UPDATE on table public."feed_boards" to "service_role";

grant DELETE on table public."feed_boards" to "service_role";

grant TRUNCATE on table public."feed_boards" to "service_role";

grant REFERENCES on table public."feed_boards" to "service_role";

grant TRIGGER on table public."feed_boards" to "service_role";

grant INSERT on table public."feed_board_item_assets" to "postgres";

grant SELECT on table public."feed_board_item_assets" to "postgres";

grant UPDATE on table public."feed_board_item_assets" to "postgres";

grant DELETE on table public."feed_board_item_assets" to "postgres";

grant TRUNCATE on table public."feed_board_item_assets" to "postgres";

grant REFERENCES on table public."feed_board_item_assets" to "postgres";

grant TRIGGER on table public."feed_board_item_assets" to "postgres";

grant INSERT on table public."feed_board_item_assets" to "anon";

grant SELECT on table public."feed_board_item_assets" to "anon";

grant UPDATE on table public."feed_board_item_assets" to "anon";

grant DELETE on table public."feed_board_item_assets" to "anon";

grant TRUNCATE on table public."feed_board_item_assets" to "anon";

grant REFERENCES on table public."feed_board_item_assets" to "anon";

grant TRIGGER on table public."feed_board_item_assets" to "anon";

grant INSERT on table public."feed_board_item_assets" to "authenticated";

grant SELECT on table public."feed_board_item_assets" to "authenticated";

grant UPDATE on table public."feed_board_item_assets" to "authenticated";

grant DELETE on table public."feed_board_item_assets" to "authenticated";

grant TRUNCATE on table public."feed_board_item_assets" to "authenticated";

grant REFERENCES on table public."feed_board_item_assets" to "authenticated";

grant TRIGGER on table public."feed_board_item_assets" to "authenticated";

grant INSERT on table public."feed_board_item_assets" to "service_role";

grant SELECT on table public."feed_board_item_assets" to "service_role";

grant UPDATE on table public."feed_board_item_assets" to "service_role";

grant DELETE on table public."feed_board_item_assets" to "service_role";

grant TRUNCATE on table public."feed_board_item_assets" to "service_role";

grant REFERENCES on table public."feed_board_item_assets" to "service_role";

grant TRIGGER on table public."feed_board_item_assets" to "service_role";

grant INSERT on table public."feed_board_items" to "postgres";

grant SELECT on table public."feed_board_items" to "postgres";

grant UPDATE on table public."feed_board_items" to "postgres";

grant DELETE on table public."feed_board_items" to "postgres";

grant TRUNCATE on table public."feed_board_items" to "postgres";

grant REFERENCES on table public."feed_board_items" to "postgres";

grant TRIGGER on table public."feed_board_items" to "postgres";

grant INSERT on table public."feed_board_items" to "anon";

grant SELECT on table public."feed_board_items" to "anon";

grant UPDATE on table public."feed_board_items" to "anon";

grant DELETE on table public."feed_board_items" to "anon";

grant TRUNCATE on table public."feed_board_items" to "anon";

grant REFERENCES on table public."feed_board_items" to "anon";

grant TRIGGER on table public."feed_board_items" to "anon";

grant INSERT on table public."feed_board_items" to "authenticated";

grant SELECT on table public."feed_board_items" to "authenticated";

grant UPDATE on table public."feed_board_items" to "authenticated";

grant DELETE on table public."feed_board_items" to "authenticated";

grant TRUNCATE on table public."feed_board_items" to "authenticated";

grant REFERENCES on table public."feed_board_items" to "authenticated";

grant TRIGGER on table public."feed_board_items" to "authenticated";

grant INSERT on table public."feed_board_items" to "service_role";

grant SELECT on table public."feed_board_items" to "service_role";

grant UPDATE on table public."feed_board_items" to "service_role";

grant DELETE on table public."feed_board_items" to "service_role";

grant TRUNCATE on table public."feed_board_items" to "service_role";

grant REFERENCES on table public."feed_board_items" to "service_role";

grant TRIGGER on table public."feed_board_items" to "service_role";

grant INSERT on table public."ampy_agentes" to "postgres";

grant SELECT on table public."ampy_agentes" to "postgres";

grant UPDATE on table public."ampy_agentes" to "postgres";

grant DELETE on table public."ampy_agentes" to "postgres";

grant TRUNCATE on table public."ampy_agentes" to "postgres";

grant REFERENCES on table public."ampy_agentes" to "postgres";

grant TRIGGER on table public."ampy_agentes" to "postgres";

grant INSERT on table public."ampy_agentes" to "service_role";

grant SELECT on table public."ampy_agentes" to "service_role";

grant UPDATE on table public."ampy_agentes" to "service_role";

grant DELETE on table public."ampy_agentes" to "service_role";

grant TRUNCATE on table public."ampy_agentes" to "service_role";

grant REFERENCES on table public."ampy_agentes" to "service_role";

grant TRIGGER on table public."ampy_agentes" to "service_role";

grant INSERT on table public."avisos" to "postgres";

grant SELECT on table public."avisos" to "postgres";

grant UPDATE on table public."avisos" to "postgres";

grant DELETE on table public."avisos" to "postgres";

grant TRUNCATE on table public."avisos" to "postgres";

grant REFERENCES on table public."avisos" to "postgres";

grant TRIGGER on table public."avisos" to "postgres";

grant INSERT on table public."avisos" to "anon";

grant SELECT on table public."avisos" to "anon";

grant UPDATE on table public."avisos" to "anon";

grant DELETE on table public."avisos" to "anon";

grant TRUNCATE on table public."avisos" to "anon";

grant REFERENCES on table public."avisos" to "anon";

grant TRIGGER on table public."avisos" to "anon";

grant INSERT on table public."avisos" to "authenticated";

grant SELECT on table public."avisos" to "authenticated";

grant UPDATE on table public."avisos" to "authenticated";

grant DELETE on table public."avisos" to "authenticated";

grant TRUNCATE on table public."avisos" to "authenticated";

grant REFERENCES on table public."avisos" to "authenticated";

grant TRIGGER on table public."avisos" to "authenticated";

grant INSERT on table public."avisos" to "service_role";

grant SELECT on table public."avisos" to "service_role";

grant UPDATE on table public."avisos" to "service_role";

grant DELETE on table public."avisos" to "service_role";

grant TRUNCATE on table public."avisos" to "service_role";

grant REFERENCES on table public."avisos" to "service_role";

grant TRIGGER on table public."avisos" to "service_role";

grant INSERT on table public."internal_messages" to "postgres";

grant SELECT on table public."internal_messages" to "postgres";

grant UPDATE on table public."internal_messages" to "postgres";

grant DELETE on table public."internal_messages" to "postgres";

grant TRUNCATE on table public."internal_messages" to "postgres";

grant REFERENCES on table public."internal_messages" to "postgres";

grant TRIGGER on table public."internal_messages" to "postgres";

grant INSERT on table public."internal_messages" to "anon";

grant SELECT on table public."internal_messages" to "anon";

grant UPDATE on table public."internal_messages" to "anon";

grant DELETE on table public."internal_messages" to "anon";

grant TRUNCATE on table public."internal_messages" to "anon";

grant REFERENCES on table public."internal_messages" to "anon";

grant TRIGGER on table public."internal_messages" to "anon";

grant INSERT on table public."internal_messages" to "authenticated";

grant SELECT on table public."internal_messages" to "authenticated";

grant UPDATE on table public."internal_messages" to "authenticated";

grant DELETE on table public."internal_messages" to "authenticated";

grant TRUNCATE on table public."internal_messages" to "authenticated";

grant REFERENCES on table public."internal_messages" to "authenticated";

grant TRIGGER on table public."internal_messages" to "authenticated";

grant INSERT on table public."internal_messages" to "service_role";

grant SELECT on table public."internal_messages" to "service_role";

grant UPDATE on table public."internal_messages" to "service_role";

grant DELETE on table public."internal_messages" to "service_role";

grant TRUNCATE on table public."internal_messages" to "service_role";

grant REFERENCES on table public."internal_messages" to "service_role";

grant TRIGGER on table public."internal_messages" to "service_role";

grant INSERT on table public."internal_message_mentions" to "postgres";

grant SELECT on table public."internal_message_mentions" to "postgres";

grant UPDATE on table public."internal_message_mentions" to "postgres";

grant DELETE on table public."internal_message_mentions" to "postgres";

grant TRUNCATE on table public."internal_message_mentions" to "postgres";

grant REFERENCES on table public."internal_message_mentions" to "postgres";

grant TRIGGER on table public."internal_message_mentions" to "postgres";

grant INSERT on table public."internal_message_mentions" to "anon";

grant SELECT on table public."internal_message_mentions" to "anon";

grant UPDATE on table public."internal_message_mentions" to "anon";

grant DELETE on table public."internal_message_mentions" to "anon";

grant TRUNCATE on table public."internal_message_mentions" to "anon";

grant REFERENCES on table public."internal_message_mentions" to "anon";

grant TRIGGER on table public."internal_message_mentions" to "anon";

grant INSERT on table public."internal_message_mentions" to "authenticated";

grant SELECT on table public."internal_message_mentions" to "authenticated";

grant UPDATE on table public."internal_message_mentions" to "authenticated";

grant DELETE on table public."internal_message_mentions" to "authenticated";

grant TRUNCATE on table public."internal_message_mentions" to "authenticated";

grant REFERENCES on table public."internal_message_mentions" to "authenticated";

grant TRIGGER on table public."internal_message_mentions" to "authenticated";

grant INSERT on table public."internal_message_mentions" to "service_role";

grant SELECT on table public."internal_message_mentions" to "service_role";

grant UPDATE on table public."internal_message_mentions" to "service_role";

grant DELETE on table public."internal_message_mentions" to "service_role";

grant TRUNCATE on table public."internal_message_mentions" to "service_role";

grant REFERENCES on table public."internal_message_mentions" to "service_role";

grant TRIGGER on table public."internal_message_mentions" to "service_role";

grant INSERT on table public."boards" to "postgres";

grant SELECT on table public."boards" to "postgres";

grant UPDATE on table public."boards" to "postgres";

grant DELETE on table public."boards" to "postgres";

grant TRUNCATE on table public."boards" to "postgres";

grant REFERENCES on table public."boards" to "postgres";

grant TRIGGER on table public."boards" to "postgres";

grant INSERT on table public."boards" to "anon";

grant SELECT on table public."boards" to "anon";

grant UPDATE on table public."boards" to "anon";

grant DELETE on table public."boards" to "anon";

grant TRUNCATE on table public."boards" to "anon";

grant REFERENCES on table public."boards" to "anon";

grant TRIGGER on table public."boards" to "anon";

grant INSERT on table public."boards" to "authenticated";

grant SELECT on table public."boards" to "authenticated";

grant UPDATE on table public."boards" to "authenticated";

grant DELETE on table public."boards" to "authenticated";

grant TRUNCATE on table public."boards" to "authenticated";

grant REFERENCES on table public."boards" to "authenticated";

grant TRIGGER on table public."boards" to "authenticated";

grant INSERT on table public."boards" to "service_role";

grant SELECT on table public."boards" to "service_role";

grant UPDATE on table public."boards" to "service_role";

grant DELETE on table public."boards" to "service_role";

grant TRUNCATE on table public."boards" to "service_role";

grant REFERENCES on table public."boards" to "service_role";

grant TRIGGER on table public."boards" to "service_role";

grant INSERT on table public."project_step_statuses" to "postgres";

grant SELECT on table public."project_step_statuses" to "postgres";

grant UPDATE on table public."project_step_statuses" to "postgres";

grant DELETE on table public."project_step_statuses" to "postgres";

grant TRUNCATE on table public."project_step_statuses" to "postgres";

grant REFERENCES on table public."project_step_statuses" to "postgres";

grant TRIGGER on table public."project_step_statuses" to "postgres";

grant INSERT on table public."project_step_statuses" to "anon";

grant SELECT on table public."project_step_statuses" to "anon";

grant UPDATE on table public."project_step_statuses" to "anon";

grant DELETE on table public."project_step_statuses" to "anon";

grant TRUNCATE on table public."project_step_statuses" to "anon";

grant REFERENCES on table public."project_step_statuses" to "anon";

grant TRIGGER on table public."project_step_statuses" to "anon";

grant INSERT on table public."project_step_statuses" to "authenticated";

grant SELECT on table public."project_step_statuses" to "authenticated";

grant UPDATE on table public."project_step_statuses" to "authenticated";

grant DELETE on table public."project_step_statuses" to "authenticated";

grant TRUNCATE on table public."project_step_statuses" to "authenticated";

grant REFERENCES on table public."project_step_statuses" to "authenticated";

grant TRIGGER on table public."project_step_statuses" to "authenticated";

grant INSERT on table public."project_step_statuses" to "service_role";

grant SELECT on table public."project_step_statuses" to "service_role";

grant UPDATE on table public."project_step_statuses" to "service_role";

grant DELETE on table public."project_step_statuses" to "service_role";

grant TRUNCATE on table public."project_step_statuses" to "service_role";

grant REFERENCES on table public."project_step_statuses" to "service_role";

grant TRIGGER on table public."project_step_statuses" to "service_role";

grant INSERT on table public."board_columns" to "postgres";

grant SELECT on table public."board_columns" to "postgres";

grant UPDATE on table public."board_columns" to "postgres";

grant DELETE on table public."board_columns" to "postgres";

grant TRUNCATE on table public."board_columns" to "postgres";

grant REFERENCES on table public."board_columns" to "postgres";

grant TRIGGER on table public."board_columns" to "postgres";

grant INSERT on table public."board_columns" to "anon";

grant SELECT on table public."board_columns" to "anon";

grant UPDATE on table public."board_columns" to "anon";

grant DELETE on table public."board_columns" to "anon";

grant TRUNCATE on table public."board_columns" to "anon";

grant REFERENCES on table public."board_columns" to "anon";

grant TRIGGER on table public."board_columns" to "anon";

grant INSERT on table public."board_columns" to "authenticated";

grant SELECT on table public."board_columns" to "authenticated";

grant UPDATE on table public."board_columns" to "authenticated";

grant DELETE on table public."board_columns" to "authenticated";

grant TRUNCATE on table public."board_columns" to "authenticated";

grant REFERENCES on table public."board_columns" to "authenticated";

grant TRIGGER on table public."board_columns" to "authenticated";

grant INSERT on table public."board_columns" to "service_role";

grant SELECT on table public."board_columns" to "service_role";

grant UPDATE on table public."board_columns" to "service_role";

grant DELETE on table public."board_columns" to "service_role";

grant TRUNCATE on table public."board_columns" to "service_role";

grant REFERENCES on table public."board_columns" to "service_role";

grant TRIGGER on table public."board_columns" to "service_role";

grant INSERT on table public."team_access_audit" to "postgres";

grant SELECT on table public."team_access_audit" to "postgres";

grant UPDATE on table public."team_access_audit" to "postgres";

grant DELETE on table public."team_access_audit" to "postgres";

grant TRUNCATE on table public."team_access_audit" to "postgres";

grant REFERENCES on table public."team_access_audit" to "postgres";

grant TRIGGER on table public."team_access_audit" to "postgres";

grant INSERT on table public."team_access_audit" to "anon";

grant SELECT on table public."team_access_audit" to "anon";

grant UPDATE on table public."team_access_audit" to "anon";

grant DELETE on table public."team_access_audit" to "anon";

grant TRUNCATE on table public."team_access_audit" to "anon";

grant REFERENCES on table public."team_access_audit" to "anon";

grant TRIGGER on table public."team_access_audit" to "anon";

grant INSERT on table public."team_access_audit" to "authenticated";

grant SELECT on table public."team_access_audit" to "authenticated";

grant UPDATE on table public."team_access_audit" to "authenticated";

grant DELETE on table public."team_access_audit" to "authenticated";

grant TRUNCATE on table public."team_access_audit" to "authenticated";

grant REFERENCES on table public."team_access_audit" to "authenticated";

grant TRIGGER on table public."team_access_audit" to "authenticated";

grant INSERT on table public."team_access_audit" to "service_role";

grant SELECT on table public."team_access_audit" to "service_role";

grant UPDATE on table public."team_access_audit" to "service_role";

grant DELETE on table public."team_access_audit" to "service_role";

grant TRUNCATE on table public."team_access_audit" to "service_role";

grant REFERENCES on table public."team_access_audit" to "service_role";

grant TRIGGER on table public."team_access_audit" to "service_role";

grant INSERT on table public."team_members" to "postgres";

grant SELECT on table public."team_members" to "postgres";

grant UPDATE on table public."team_members" to "postgres";

grant DELETE on table public."team_members" to "postgres";

grant TRUNCATE on table public."team_members" to "postgres";

grant REFERENCES on table public."team_members" to "postgres";

grant TRIGGER on table public."team_members" to "postgres";

grant INSERT on table public."team_members" to "anon";

grant SELECT on table public."team_members" to "anon";

grant UPDATE on table public."team_members" to "anon";

grant DELETE on table public."team_members" to "anon";

grant TRUNCATE on table public."team_members" to "anon";

grant REFERENCES on table public."team_members" to "anon";

grant TRIGGER on table public."team_members" to "anon";

grant INSERT on table public."team_members" to "authenticated";

grant SELECT on table public."team_members" to "authenticated";

grant UPDATE on table public."team_members" to "authenticated";

grant DELETE on table public."team_members" to "authenticated";

grant TRUNCATE on table public."team_members" to "authenticated";

grant REFERENCES on table public."team_members" to "authenticated";

grant TRIGGER on table public."team_members" to "authenticated";

grant INSERT on table public."team_members" to "service_role";

grant SELECT on table public."team_members" to "service_role";

grant UPDATE on table public."team_members" to "service_role";

grant DELETE on table public."team_members" to "service_role";

grant TRUNCATE on table public."team_members" to "service_role";

grant REFERENCES on table public."team_members" to "service_role";

grant TRIGGER on table public."team_members" to "service_role";

grant INSERT on table public."work_item_schedule_requirements" to "postgres";

grant SELECT on table public."work_item_schedule_requirements" to "postgres";

grant UPDATE on table public."work_item_schedule_requirements" to "postgres";

grant DELETE on table public."work_item_schedule_requirements" to "postgres";

grant TRUNCATE on table public."work_item_schedule_requirements" to "postgres";

grant REFERENCES on table public."work_item_schedule_requirements" to "postgres";

grant TRIGGER on table public."work_item_schedule_requirements" to "postgres";

grant INSERT on table public."work_item_schedule_requirements" to "anon";

grant SELECT on table public."work_item_schedule_requirements" to "anon";

grant UPDATE on table public."work_item_schedule_requirements" to "anon";

grant DELETE on table public."work_item_schedule_requirements" to "anon";

grant TRUNCATE on table public."work_item_schedule_requirements" to "anon";

grant REFERENCES on table public."work_item_schedule_requirements" to "anon";

grant TRIGGER on table public."work_item_schedule_requirements" to "anon";

grant INSERT on table public."work_item_schedule_requirements" to "authenticated";

grant SELECT on table public."work_item_schedule_requirements" to "authenticated";

grant UPDATE on table public."work_item_schedule_requirements" to "authenticated";

grant DELETE on table public."work_item_schedule_requirements" to "authenticated";

grant TRUNCATE on table public."work_item_schedule_requirements" to "authenticated";

grant REFERENCES on table public."work_item_schedule_requirements" to "authenticated";

grant TRIGGER on table public."work_item_schedule_requirements" to "authenticated";

grant INSERT on table public."work_item_schedule_requirements" to "service_role";

grant SELECT on table public."work_item_schedule_requirements" to "service_role";

grant UPDATE on table public."work_item_schedule_requirements" to "service_role";

grant DELETE on table public."work_item_schedule_requirements" to "service_role";

grant TRUNCATE on table public."work_item_schedule_requirements" to "service_role";

grant REFERENCES on table public."work_item_schedule_requirements" to "service_role";

grant TRIGGER on table public."work_item_schedule_requirements" to "service_role";

grant INSERT on table public."pautas" to "postgres";

grant SELECT on table public."pautas" to "postgres";

grant UPDATE on table public."pautas" to "postgres";

grant DELETE on table public."pautas" to "postgres";

grant TRUNCATE on table public."pautas" to "postgres";

grant REFERENCES on table public."pautas" to "postgres";

grant TRIGGER on table public."pautas" to "postgres";

grant INSERT on table public."pautas" to "anon";

grant SELECT on table public."pautas" to "anon";

grant UPDATE on table public."pautas" to "anon";

grant DELETE on table public."pautas" to "anon";

grant TRUNCATE on table public."pautas" to "anon";

grant REFERENCES on table public."pautas" to "anon";

grant TRIGGER on table public."pautas" to "anon";

grant SELECT on table public."pautas" to "authenticated";

grant TRUNCATE on table public."pautas" to "authenticated";

grant REFERENCES on table public."pautas" to "authenticated";

grant TRIGGER on table public."pautas" to "authenticated";

grant INSERT on table public."pautas" to "service_role";

grant SELECT on table public."pautas" to "service_role";

grant UPDATE on table public."pautas" to "service_role";

grant DELETE on table public."pautas" to "service_role";

grant TRUNCATE on table public."pautas" to "service_role";

grant REFERENCES on table public."pautas" to "service_role";

grant TRIGGER on table public."pautas" to "service_role";

grant INSERT on table public."work_items" to "postgres";

grant SELECT on table public."work_items" to "postgres";

grant UPDATE on table public."work_items" to "postgres";

grant DELETE on table public."work_items" to "postgres";

grant TRUNCATE on table public."work_items" to "postgres";

grant REFERENCES on table public."work_items" to "postgres";

grant TRIGGER on table public."work_items" to "postgres";

grant INSERT on table public."work_items" to "anon";

grant SELECT on table public."work_items" to "anon";

grant UPDATE on table public."work_items" to "anon";

grant DELETE on table public."work_items" to "anon";

grant TRUNCATE on table public."work_items" to "anon";

grant REFERENCES on table public."work_items" to "anon";

grant TRIGGER on table public."work_items" to "anon";

grant INSERT on table public."work_items" to "authenticated";

grant SELECT on table public."work_items" to "authenticated";

grant UPDATE on table public."work_items" to "authenticated";

grant DELETE on table public."work_items" to "authenticated";

grant TRUNCATE on table public."work_items" to "authenticated";

grant REFERENCES on table public."work_items" to "authenticated";

grant TRIGGER on table public."work_items" to "authenticated";

grant INSERT on table public."work_items" to "service_role";

grant SELECT on table public."work_items" to "service_role";

grant UPDATE on table public."work_items" to "service_role";

grant DELETE on table public."work_items" to "service_role";

grant TRUNCATE on table public."work_items" to "service_role";

grant REFERENCES on table public."work_items" to "service_role";

grant TRIGGER on table public."work_items" to "service_role";

grant INSERT on table public."trafego_config" to "postgres";

grant SELECT on table public."trafego_config" to "postgres";

grant UPDATE on table public."trafego_config" to "postgres";

grant DELETE on table public."trafego_config" to "postgres";

grant TRUNCATE on table public."trafego_config" to "postgres";

grant REFERENCES on table public."trafego_config" to "postgres";

grant TRIGGER on table public."trafego_config" to "postgres";

grant INSERT on table public."trafego_config" to "anon";

grant SELECT on table public."trafego_config" to "anon";

grant UPDATE on table public."trafego_config" to "anon";

grant DELETE on table public."trafego_config" to "anon";

grant TRUNCATE on table public."trafego_config" to "anon";

grant REFERENCES on table public."trafego_config" to "anon";

grant TRIGGER on table public."trafego_config" to "anon";

grant INSERT on table public."trafego_config" to "authenticated";

grant SELECT on table public."trafego_config" to "authenticated";

grant UPDATE on table public."trafego_config" to "authenticated";

grant DELETE on table public."trafego_config" to "authenticated";

grant TRUNCATE on table public."trafego_config" to "authenticated";

grant REFERENCES on table public."trafego_config" to "authenticated";

grant TRIGGER on table public."trafego_config" to "authenticated";

grant INSERT on table public."trafego_config" to "service_role";

grant SELECT on table public."trafego_config" to "service_role";

grant UPDATE on table public."trafego_config" to "service_role";

grant DELETE on table public."trafego_config" to "service_role";

grant TRUNCATE on table public."trafego_config" to "service_role";

grant REFERENCES on table public."trafego_config" to "service_role";

grant TRIGGER on table public."trafego_config" to "service_role";

grant INSERT on table public."trafego_contas" to "postgres";

grant SELECT on table public."trafego_contas" to "postgres";

grant UPDATE on table public."trafego_contas" to "postgres";

grant DELETE on table public."trafego_contas" to "postgres";

grant TRUNCATE on table public."trafego_contas" to "postgres";

grant REFERENCES on table public."trafego_contas" to "postgres";

grant TRIGGER on table public."trafego_contas" to "postgres";

grant INSERT on table public."trafego_contas" to "anon";

grant SELECT on table public."trafego_contas" to "anon";

grant UPDATE on table public."trafego_contas" to "anon";

grant DELETE on table public."trafego_contas" to "anon";

grant TRUNCATE on table public."trafego_contas" to "anon";

grant REFERENCES on table public."trafego_contas" to "anon";

grant TRIGGER on table public."trafego_contas" to "anon";

grant INSERT on table public."trafego_contas" to "authenticated";

grant SELECT on table public."trafego_contas" to "authenticated";

grant UPDATE on table public."trafego_contas" to "authenticated";

grant DELETE on table public."trafego_contas" to "authenticated";

grant TRUNCATE on table public."trafego_contas" to "authenticated";

grant REFERENCES on table public."trafego_contas" to "authenticated";

grant TRIGGER on table public."trafego_contas" to "authenticated";

grant INSERT on table public."trafego_contas" to "service_role";

grant SELECT on table public."trafego_contas" to "service_role";

grant UPDATE on table public."trafego_contas" to "service_role";

grant DELETE on table public."trafego_contas" to "service_role";

grant TRUNCATE on table public."trafego_contas" to "service_role";

grant REFERENCES on table public."trafego_contas" to "service_role";

grant TRIGGER on table public."trafego_contas" to "service_role";

grant INSERT on table public."trafego_metas" to "postgres";

grant SELECT on table public."trafego_metas" to "postgres";

grant UPDATE on table public."trafego_metas" to "postgres";

grant DELETE on table public."trafego_metas" to "postgres";

grant TRUNCATE on table public."trafego_metas" to "postgres";

grant REFERENCES on table public."trafego_metas" to "postgres";

grant TRIGGER on table public."trafego_metas" to "postgres";

grant INSERT on table public."trafego_metas" to "anon";

grant SELECT on table public."trafego_metas" to "anon";

grant UPDATE on table public."trafego_metas" to "anon";

grant DELETE on table public."trafego_metas" to "anon";

grant TRUNCATE on table public."trafego_metas" to "anon";

grant REFERENCES on table public."trafego_metas" to "anon";

grant TRIGGER on table public."trafego_metas" to "anon";

grant INSERT on table public."trafego_metas" to "authenticated";

grant SELECT on table public."trafego_metas" to "authenticated";

grant UPDATE on table public."trafego_metas" to "authenticated";

grant DELETE on table public."trafego_metas" to "authenticated";

grant TRUNCATE on table public."trafego_metas" to "authenticated";

grant REFERENCES on table public."trafego_metas" to "authenticated";

grant TRIGGER on table public."trafego_metas" to "authenticated";

grant INSERT on table public."trafego_metas" to "service_role";

grant SELECT on table public."trafego_metas" to "service_role";

grant UPDATE on table public."trafego_metas" to "service_role";

grant DELETE on table public."trafego_metas" to "service_role";

grant TRUNCATE on table public."trafego_metas" to "service_role";

grant REFERENCES on table public."trafego_metas" to "service_role";

grant TRIGGER on table public."trafego_metas" to "service_role";

grant INSERT on table public."trafego_execucoes" to "postgres";

grant SELECT on table public."trafego_execucoes" to "postgres";

grant UPDATE on table public."trafego_execucoes" to "postgres";

grant DELETE on table public."trafego_execucoes" to "postgres";

grant TRUNCATE on table public."trafego_execucoes" to "postgres";

grant REFERENCES on table public."trafego_execucoes" to "postgres";

grant TRIGGER on table public."trafego_execucoes" to "postgres";

grant INSERT on table public."trafego_execucoes" to "anon";

grant SELECT on table public."trafego_execucoes" to "anon";

grant UPDATE on table public."trafego_execucoes" to "anon";

grant DELETE on table public."trafego_execucoes" to "anon";

grant TRUNCATE on table public."trafego_execucoes" to "anon";

grant REFERENCES on table public."trafego_execucoes" to "anon";

grant TRIGGER on table public."trafego_execucoes" to "anon";

grant INSERT on table public."trafego_execucoes" to "authenticated";

grant SELECT on table public."trafego_execucoes" to "authenticated";

grant UPDATE on table public."trafego_execucoes" to "authenticated";

grant DELETE on table public."trafego_execucoes" to "authenticated";

grant TRUNCATE on table public."trafego_execucoes" to "authenticated";

grant REFERENCES on table public."trafego_execucoes" to "authenticated";

grant TRIGGER on table public."trafego_execucoes" to "authenticated";

grant INSERT on table public."trafego_execucoes" to "service_role";

grant SELECT on table public."trafego_execucoes" to "service_role";

grant UPDATE on table public."trafego_execucoes" to "service_role";

grant DELETE on table public."trafego_execucoes" to "service_role";

grant TRUNCATE on table public."trafego_execucoes" to "service_role";

grant REFERENCES on table public."trafego_execucoes" to "service_role";

grant TRIGGER on table public."trafego_execucoes" to "service_role";

grant INSERT on table public."trafego_acoes" to "postgres";

grant SELECT on table public."trafego_acoes" to "postgres";

grant UPDATE on table public."trafego_acoes" to "postgres";

grant DELETE on table public."trafego_acoes" to "postgres";

grant TRUNCATE on table public."trafego_acoes" to "postgres";

grant REFERENCES on table public."trafego_acoes" to "postgres";

grant TRIGGER on table public."trafego_acoes" to "postgres";

grant INSERT on table public."trafego_acoes" to "anon";

grant SELECT on table public."trafego_acoes" to "anon";

grant UPDATE on table public."trafego_acoes" to "anon";

grant DELETE on table public."trafego_acoes" to "anon";

grant TRUNCATE on table public."trafego_acoes" to "anon";

grant REFERENCES on table public."trafego_acoes" to "anon";

grant TRIGGER on table public."trafego_acoes" to "anon";

grant INSERT on table public."trafego_acoes" to "authenticated";

grant SELECT on table public."trafego_acoes" to "authenticated";

grant UPDATE on table public."trafego_acoes" to "authenticated";

grant DELETE on table public."trafego_acoes" to "authenticated";

grant TRUNCATE on table public."trafego_acoes" to "authenticated";

grant REFERENCES on table public."trafego_acoes" to "authenticated";

grant TRIGGER on table public."trafego_acoes" to "authenticated";

grant INSERT on table public."trafego_acoes" to "service_role";

grant SELECT on table public."trafego_acoes" to "service_role";

grant UPDATE on table public."trafego_acoes" to "service_role";

grant DELETE on table public."trafego_acoes" to "service_role";

grant TRUNCATE on table public."trafego_acoes" to "service_role";

grant REFERENCES on table public."trafego_acoes" to "service_role";

grant TRIGGER on table public."trafego_acoes" to "service_role";

grant INSERT on table public."trafego_alertas" to "postgres";

grant SELECT on table public."trafego_alertas" to "postgres";

grant UPDATE on table public."trafego_alertas" to "postgres";

grant DELETE on table public."trafego_alertas" to "postgres";

grant TRUNCATE on table public."trafego_alertas" to "postgres";

grant REFERENCES on table public."trafego_alertas" to "postgres";

grant TRIGGER on table public."trafego_alertas" to "postgres";

grant INSERT on table public."trafego_alertas" to "anon";

grant SELECT on table public."trafego_alertas" to "anon";

grant UPDATE on table public."trafego_alertas" to "anon";

grant DELETE on table public."trafego_alertas" to "anon";

grant TRUNCATE on table public."trafego_alertas" to "anon";

grant REFERENCES on table public."trafego_alertas" to "anon";

grant TRIGGER on table public."trafego_alertas" to "anon";

grant INSERT on table public."trafego_alertas" to "authenticated";

grant SELECT on table public."trafego_alertas" to "authenticated";

grant UPDATE on table public."trafego_alertas" to "authenticated";

grant DELETE on table public."trafego_alertas" to "authenticated";

grant TRUNCATE on table public."trafego_alertas" to "authenticated";

grant REFERENCES on table public."trafego_alertas" to "authenticated";

grant TRIGGER on table public."trafego_alertas" to "authenticated";

grant INSERT on table public."trafego_alertas" to "service_role";

grant SELECT on table public."trafego_alertas" to "service_role";

grant UPDATE on table public."trafego_alertas" to "service_role";

grant DELETE on table public."trafego_alertas" to "service_role";

grant TRUNCATE on table public."trafego_alertas" to "service_role";

grant REFERENCES on table public."trafego_alertas" to "service_role";

grant TRIGGER on table public."trafego_alertas" to "service_role";

grant INSERT on table public."pauta_events" to "postgres";

grant SELECT on table public."pauta_events" to "postgres";

grant UPDATE on table public."pauta_events" to "postgres";

grant DELETE on table public."pauta_events" to "postgres";

grant TRUNCATE on table public."pauta_events" to "postgres";

grant REFERENCES on table public."pauta_events" to "postgres";

grant TRIGGER on table public."pauta_events" to "postgres";

grant INSERT on table public."pauta_events" to "anon";

grant SELECT on table public."pauta_events" to "anon";

grant UPDATE on table public."pauta_events" to "anon";

grant DELETE on table public."pauta_events" to "anon";

grant TRUNCATE on table public."pauta_events" to "anon";

grant REFERENCES on table public."pauta_events" to "anon";

grant TRIGGER on table public."pauta_events" to "anon";

grant SELECT on table public."pauta_events" to "authenticated";

grant TRUNCATE on table public."pauta_events" to "authenticated";

grant REFERENCES on table public."pauta_events" to "authenticated";

grant TRIGGER on table public."pauta_events" to "authenticated";

grant INSERT on table public."pauta_events" to "service_role";

grant SELECT on table public."pauta_events" to "service_role";

grant UPDATE on table public."pauta_events" to "service_role";

grant DELETE on table public."pauta_events" to "service_role";

grant TRUNCATE on table public."pauta_events" to "service_role";

grant REFERENCES on table public."pauta_events" to "service_role";

grant TRIGGER on table public."pauta_events" to "service_role";

grant INSERT on table public."pauta_members" to "postgres";

grant SELECT on table public."pauta_members" to "postgres";

grant UPDATE on table public."pauta_members" to "postgres";

grant DELETE on table public."pauta_members" to "postgres";

grant TRUNCATE on table public."pauta_members" to "postgres";

grant REFERENCES on table public."pauta_members" to "postgres";

grant TRIGGER on table public."pauta_members" to "postgres";

grant INSERT on table public."pauta_members" to "anon";

grant SELECT on table public."pauta_members" to "anon";

grant UPDATE on table public."pauta_members" to "anon";

grant DELETE on table public."pauta_members" to "anon";

grant TRUNCATE on table public."pauta_members" to "anon";

grant REFERENCES on table public."pauta_members" to "anon";

grant TRIGGER on table public."pauta_members" to "anon";

grant SELECT on table public."pauta_members" to "authenticated";

grant TRUNCATE on table public."pauta_members" to "authenticated";

grant REFERENCES on table public."pauta_members" to "authenticated";

grant TRIGGER on table public."pauta_members" to "authenticated";

grant INSERT on table public."pauta_members" to "service_role";

grant SELECT on table public."pauta_members" to "service_role";

grant UPDATE on table public."pauta_members" to "service_role";

grant DELETE on table public."pauta_members" to "service_role";

grant TRUNCATE on table public."pauta_members" to "service_role";

grant REFERENCES on table public."pauta_members" to "service_role";

grant TRIGGER on table public."pauta_members" to "service_role";

grant INSERT on table public."work_item_board_assignments" to "postgres";

grant SELECT on table public."work_item_board_assignments" to "postgres";

grant UPDATE on table public."work_item_board_assignments" to "postgres";

grant DELETE on table public."work_item_board_assignments" to "postgres";

grant TRUNCATE on table public."work_item_board_assignments" to "postgres";

grant REFERENCES on table public."work_item_board_assignments" to "postgres";

grant TRIGGER on table public."work_item_board_assignments" to "postgres";

grant SELECT on table public."work_item_board_assignments" to "anon";

grant TRUNCATE on table public."work_item_board_assignments" to "anon";

grant REFERENCES on table public."work_item_board_assignments" to "anon";

grant TRIGGER on table public."work_item_board_assignments" to "anon";

grant SELECT on table public."work_item_board_assignments" to "authenticated";

grant TRUNCATE on table public."work_item_board_assignments" to "authenticated";

grant REFERENCES on table public."work_item_board_assignments" to "authenticated";

grant TRIGGER on table public."work_item_board_assignments" to "authenticated";

grant INSERT on table public."work_item_board_assignments" to "service_role";

grant SELECT on table public."work_item_board_assignments" to "service_role";

grant UPDATE on table public."work_item_board_assignments" to "service_role";

grant DELETE on table public."work_item_board_assignments" to "service_role";

grant TRUNCATE on table public."work_item_board_assignments" to "service_role";

grant REFERENCES on table public."work_item_board_assignments" to "service_role";

grant TRIGGER on table public."work_item_board_assignments" to "service_role";

grant INSERT on table public."work_item_board_assignment_events" to "postgres";

grant SELECT on table public."work_item_board_assignment_events" to "postgres";

grant UPDATE on table public."work_item_board_assignment_events" to "postgres";

grant DELETE on table public."work_item_board_assignment_events" to "postgres";

grant TRUNCATE on table public."work_item_board_assignment_events" to "postgres";

grant REFERENCES on table public."work_item_board_assignment_events" to "postgres";

grant TRIGGER on table public."work_item_board_assignment_events" to "postgres";

grant SELECT on table public."work_item_board_assignment_events" to "anon";

grant TRUNCATE on table public."work_item_board_assignment_events" to "anon";

grant REFERENCES on table public."work_item_board_assignment_events" to "anon";

grant TRIGGER on table public."work_item_board_assignment_events" to "anon";

grant SELECT on table public."work_item_board_assignment_events" to "authenticated";

grant TRUNCATE on table public."work_item_board_assignment_events" to "authenticated";

grant REFERENCES on table public."work_item_board_assignment_events" to "authenticated";

grant TRIGGER on table public."work_item_board_assignment_events" to "authenticated";

grant INSERT on table public."work_item_board_assignment_events" to "service_role";

grant SELECT on table public."work_item_board_assignment_events" to "service_role";

grant UPDATE on table public."work_item_board_assignment_events" to "service_role";

grant DELETE on table public."work_item_board_assignment_events" to "service_role";

grant TRUNCATE on table public."work_item_board_assignment_events" to "service_role";

grant REFERENCES on table public."work_item_board_assignment_events" to "service_role";

grant TRIGGER on table public."work_item_board_assignment_events" to "service_role";

grant INSERT on table public."calendar_event_history" to "postgres";

grant SELECT on table public."calendar_event_history" to "postgres";

grant UPDATE on table public."calendar_event_history" to "postgres";

grant DELETE on table public."calendar_event_history" to "postgres";

grant TRUNCATE on table public."calendar_event_history" to "postgres";

grant REFERENCES on table public."calendar_event_history" to "postgres";

grant TRIGGER on table public."calendar_event_history" to "postgres";

grant SELECT on table public."calendar_event_history" to "anon";

grant TRUNCATE on table public."calendar_event_history" to "anon";

grant REFERENCES on table public."calendar_event_history" to "anon";

grant TRIGGER on table public."calendar_event_history" to "anon";

grant SELECT on table public."calendar_event_history" to "authenticated";

grant TRUNCATE on table public."calendar_event_history" to "authenticated";

grant REFERENCES on table public."calendar_event_history" to "authenticated";

grant TRIGGER on table public."calendar_event_history" to "authenticated";

grant INSERT on table public."calendar_event_history" to "service_role";

grant SELECT on table public."calendar_event_history" to "service_role";

grant UPDATE on table public."calendar_event_history" to "service_role";

grant DELETE on table public."calendar_event_history" to "service_role";

grant TRUNCATE on table public."calendar_event_history" to "service_role";

grant REFERENCES on table public."calendar_event_history" to "service_role";

grant TRIGGER on table public."calendar_event_history" to "service_role";

grant INSERT on table public."meta_campaigns" to "postgres";

grant SELECT on table public."meta_campaigns" to "postgres";

grant UPDATE on table public."meta_campaigns" to "postgres";

grant DELETE on table public."meta_campaigns" to "postgres";

grant TRUNCATE on table public."meta_campaigns" to "postgres";

grant REFERENCES on table public."meta_campaigns" to "postgres";

grant TRIGGER on table public."meta_campaigns" to "postgres";

grant INSERT on table public."meta_campaigns" to "service_role";

grant SELECT on table public."meta_campaigns" to "service_role";

grant UPDATE on table public."meta_campaigns" to "service_role";

grant DELETE on table public."meta_campaigns" to "service_role";

grant TRUNCATE on table public."meta_campaigns" to "service_role";

grant REFERENCES on table public."meta_campaigns" to "service_role";

grant TRIGGER on table public."meta_campaigns" to "service_role";

grant INSERT on table public."meta_adsets" to "postgres";

grant SELECT on table public."meta_adsets" to "postgres";

grant UPDATE on table public."meta_adsets" to "postgres";

grant DELETE on table public."meta_adsets" to "postgres";

grant TRUNCATE on table public."meta_adsets" to "postgres";

grant REFERENCES on table public."meta_adsets" to "postgres";

grant TRIGGER on table public."meta_adsets" to "postgres";

grant INSERT on table public."meta_adsets" to "service_role";

grant SELECT on table public."meta_adsets" to "service_role";

grant UPDATE on table public."meta_adsets" to "service_role";

grant DELETE on table public."meta_adsets" to "service_role";

grant TRUNCATE on table public."meta_adsets" to "service_role";

grant REFERENCES on table public."meta_adsets" to "service_role";

grant TRIGGER on table public."meta_adsets" to "service_role";

grant INSERT on table public."meta_ads" to "postgres";

grant SELECT on table public."meta_ads" to "postgres";

grant UPDATE on table public."meta_ads" to "postgres";

grant DELETE on table public."meta_ads" to "postgres";

grant TRUNCATE on table public."meta_ads" to "postgres";

grant REFERENCES on table public."meta_ads" to "postgres";

grant TRIGGER on table public."meta_ads" to "postgres";

grant INSERT on table public."meta_ads" to "service_role";

grant SELECT on table public."meta_ads" to "service_role";

grant UPDATE on table public."meta_ads" to "service_role";

grant DELETE on table public."meta_ads" to "service_role";

grant TRUNCATE on table public."meta_ads" to "service_role";

grant REFERENCES on table public."meta_ads" to "service_role";

grant TRIGGER on table public."meta_ads" to "service_role";

grant INSERT on table public."meta_sync_runs" to "postgres";

grant SELECT on table public."meta_sync_runs" to "postgres";

grant UPDATE on table public."meta_sync_runs" to "postgres";

grant DELETE on table public."meta_sync_runs" to "postgres";

grant TRUNCATE on table public."meta_sync_runs" to "postgres";

grant REFERENCES on table public."meta_sync_runs" to "postgres";

grant TRIGGER on table public."meta_sync_runs" to "postgres";

grant INSERT on table public."meta_sync_runs" to "service_role";

grant SELECT on table public."meta_sync_runs" to "service_role";

grant UPDATE on table public."meta_sync_runs" to "service_role";

grant DELETE on table public."meta_sync_runs" to "service_role";

grant TRUNCATE on table public."meta_sync_runs" to "service_role";

grant REFERENCES on table public."meta_sync_runs" to "service_role";

grant TRIGGER on table public."meta_sync_runs" to "service_role";

grant INSERT on table public."meta_insights_daily" to "postgres";

grant SELECT on table public."meta_insights_daily" to "postgres";

grant UPDATE on table public."meta_insights_daily" to "postgres";

grant DELETE on table public."meta_insights_daily" to "postgres";

grant TRUNCATE on table public."meta_insights_daily" to "postgres";

grant REFERENCES on table public."meta_insights_daily" to "postgres";

grant TRIGGER on table public."meta_insights_daily" to "postgres";

grant INSERT on table public."meta_insights_daily" to "service_role";

grant SELECT on table public."meta_insights_daily" to "service_role";

grant UPDATE on table public."meta_insights_daily" to "service_role";

grant DELETE on table public."meta_insights_daily" to "service_role";

grant TRUNCATE on table public."meta_insights_daily" to "service_role";

grant REFERENCES on table public."meta_insights_daily" to "service_role";

grant TRIGGER on table public."meta_insights_daily" to "service_role";

grant INSERT on table public."meta_ad_accounts" to "postgres";

grant SELECT on table public."meta_ad_accounts" to "postgres";

grant UPDATE on table public."meta_ad_accounts" to "postgres";

grant DELETE on table public."meta_ad_accounts" to "postgres";

grant TRUNCATE on table public."meta_ad_accounts" to "postgres";

grant REFERENCES on table public."meta_ad_accounts" to "postgres";

grant TRIGGER on table public."meta_ad_accounts" to "postgres";

grant INSERT on table public."meta_ad_accounts" to "service_role";

grant SELECT on table public."meta_ad_accounts" to "service_role";

grant UPDATE on table public."meta_ad_accounts" to "service_role";

grant DELETE on table public."meta_ad_accounts" to "service_role";

grant TRUNCATE on table public."meta_ad_accounts" to "service_role";

grant REFERENCES on table public."meta_ad_accounts" to "service_role";

grant TRIGGER on table public."meta_ad_accounts" to "service_role";

grant INSERT on table public."vw_meta_campanhas_dia" to "postgres";

grant SELECT on table public."vw_meta_campanhas_dia" to "postgres";

grant UPDATE on table public."vw_meta_campanhas_dia" to "postgres";

grant DELETE on table public."vw_meta_campanhas_dia" to "postgres";

grant TRUNCATE on table public."vw_meta_campanhas_dia" to "postgres";

grant REFERENCES on table public."vw_meta_campanhas_dia" to "postgres";

grant TRIGGER on table public."vw_meta_campanhas_dia" to "postgres";

grant INSERT on table public."vw_meta_campanhas_dia" to "service_role";

grant SELECT on table public."vw_meta_campanhas_dia" to "service_role";

grant UPDATE on table public."vw_meta_campanhas_dia" to "service_role";

grant DELETE on table public."vw_meta_campanhas_dia" to "service_role";

grant TRUNCATE on table public."vw_meta_campanhas_dia" to "service_role";

grant REFERENCES on table public."vw_meta_campanhas_dia" to "service_role";

grant TRIGGER on table public."vw_meta_campanhas_dia" to "service_role";

grant INSERT on table public."vw_meta_contas_dia" to "postgres";

grant SELECT on table public."vw_meta_contas_dia" to "postgres";

grant UPDATE on table public."vw_meta_contas_dia" to "postgres";

grant DELETE on table public."vw_meta_contas_dia" to "postgres";

grant TRUNCATE on table public."vw_meta_contas_dia" to "postgres";

grant REFERENCES on table public."vw_meta_contas_dia" to "postgres";

grant TRIGGER on table public."vw_meta_contas_dia" to "postgres";

grant INSERT on table public."vw_meta_contas_dia" to "service_role";

grant SELECT on table public."vw_meta_contas_dia" to "service_role";

grant UPDATE on table public."vw_meta_contas_dia" to "service_role";

grant DELETE on table public."vw_meta_contas_dia" to "service_role";

grant TRUNCATE on table public."vw_meta_contas_dia" to "service_role";

grant REFERENCES on table public."vw_meta_contas_dia" to "service_role";

grant TRIGGER on table public."vw_meta_contas_dia" to "service_role";


-- Privilégios de funções capturados do catálogo (não usar defaults PUBLIC).
revoke all on function public.meta_result_label(p_indicator text) from public, anon, authenticated, service_role;
grant execute on function public.meta_result_label(p_indicator text) to public;
grant execute on function public.meta_result_label(p_indicator text) to postgres;
grant execute on function public.meta_result_label(p_indicator text) to anon;
grant execute on function public.meta_result_label(p_indicator text) to authenticated;
grant execute on function public.meta_result_label(p_indicator text) to service_role;
revoke all on function public.n8n_traffic_secret() from public, anon, authenticated, service_role;
grant execute on function public.n8n_traffic_secret() to postgres;
grant execute on function public.n8n_traffic_secret() to service_role;
revoke all on function public.traffic_weekly_report(p_since date, p_until date, p_account_ids text[]) from public, anon, authenticated, service_role;
grant execute on function public.traffic_weekly_report(p_since date, p_until date, p_account_ids text[]) to postgres;
grant execute on function public.traffic_weekly_report(p_since date, p_until date, p_account_ids text[]) to service_role;
revoke all on function public.meta_action_sum(p_actions jsonb, p_types text[]) from public, anon, authenticated, service_role;
grant execute on function public.meta_action_sum(p_actions jsonb, p_types text[]) to postgres;
grant execute on function public.meta_action_sum(p_actions jsonb, p_types text[]) to authenticated;
grant execute on function public.meta_action_sum(p_actions jsonb, p_types text[]) to service_role;
revoke all on function public.traffic_prev_period(p_since date, p_until date, OUT prev_since date, OUT prev_until date) from public, anon, authenticated, service_role;
grant execute on function public.traffic_prev_period(p_since date, p_until date, OUT prev_since date, OUT prev_until date) to postgres;
grant execute on function public.traffic_prev_period(p_since date, p_until date, OUT prev_since date, OUT prev_until date) to service_role;
revoke all on function public.traffic_client_report(p_report_client_id uuid, p_since date, p_until date) from public, anon, authenticated, service_role;
grant execute on function public.traffic_client_report(p_report_client_id uuid, p_since date, p_until date) to postgres;
grant execute on function public.traffic_client_report(p_report_client_id uuid, p_since date, p_until date) to service_role;
revoke all on function public.comercial_rotulo(p timestamp with time zone) from public, anon, authenticated, service_role;
grant execute on function public.comercial_rotulo(p timestamp with time zone) to postgres;
grant execute on function public.comercial_rotulo(p timestamp with time zone) to service_role;
revoke all on function public.comercial_touch() from public, anon, authenticated, service_role;
grant execute on function public.comercial_touch() to postgres;
grant execute on function public.comercial_touch() to service_role;
revoke all on function public.comercial_salvar_lead(p_session text, p_dados jsonb) from public, anon, authenticated, service_role;
grant execute on function public.comercial_salvar_lead(p_session text, p_dados jsonb) to postgres;
grant execute on function public.comercial_salvar_lead(p_session text, p_dados jsonb) to service_role;
revoke all on function public.set_internal_messages_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.set_internal_messages_updated_at() to public;
grant execute on function public.set_internal_messages_updated_at() to postgres;
grant execute on function public.set_internal_messages_updated_at() to anon;
grant execute on function public.set_internal_messages_updated_at() to authenticated;
grant execute on function public.set_internal_messages_updated_at() to service_role;
revoke all on function public.comercial_horarios_livres(p_limite integer, p_ocupados jsonb) from public, anon, authenticated, service_role;
grant execute on function public.comercial_horarios_livres(p_limite integer, p_ocupados jsonb) to postgres;
grant execute on function public.comercial_horarios_livres(p_limite integer, p_ocupados jsonb) to service_role;
revoke all on function public.comercial_agendar(p_session text, p_inicio timestamp with time zone, p_formato text, p_email text) from public, anon, authenticated, service_role;
grant execute on function public.comercial_agendar(p_session text, p_inicio timestamp with time zone, p_formato text, p_email text) to postgres;
grant execute on function public.comercial_agendar(p_session text, p_inicio timestamp with time zone, p_formato text, p_email text) to service_role;
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;
grant execute on function public.rls_auto_enable() to postgres;
grant execute on function public.rls_auto_enable() to authenticated;
grant execute on function public.rls_auto_enable() to service_role;
revoke all on function public.app_has_total_access() from public, anon, authenticated, service_role;
grant execute on function public.app_has_total_access() to postgres;
grant execute on function public.app_has_total_access() to authenticated;
grant execute on function public.app_has_total_access() to service_role;
revoke all on function public.comercial_registrar_mensagem(p_session text, p_direcao text, p_texto text, p_wa_id text) from public, anon, authenticated, service_role;
grant execute on function public.comercial_registrar_mensagem(p_session text, p_direcao text, p_texto text, p_wa_id text) to postgres;
grant execute on function public.comercial_registrar_mensagem(p_session text, p_direcao text, p_texto text, p_wa_id text) to service_role;
revoke all on function public.comercial_eco(p_session text, p_texto text, p_wa_id text) from public, anon, authenticated, service_role;
grant execute on function public.comercial_eco(p_session text, p_texto text, p_wa_id text) to postgres;
grant execute on function public.comercial_eco(p_session text, p_texto text, p_wa_id text) to service_role;
revoke all on function public.has_total_access() from public, anon, authenticated, service_role;
grant execute on function public.has_total_access() to postgres;
grant execute on function public.has_total_access() to authenticated;
grant execute on function public.has_total_access() to service_role;
revoke all on function public.generate_next_work_item_cycle(p_source_id uuid, p_client_service_id uuid, p_start_date date, p_end_date date, p_programming_verified boolean, p_confirmation text) from public, anon, authenticated, service_role;
grant execute on function public.generate_next_work_item_cycle(p_source_id uuid, p_client_service_id uuid, p_start_date date, p_end_date date, p_programming_verified boolean, p_confirmation text) to postgres;
grant execute on function public.generate_next_work_item_cycle(p_source_id uuid, p_client_service_id uuid, p_start_date date, p_end_date date, p_programming_verified boolean, p_confirmation text) to authenticated;
grant execute on function public.generate_next_work_item_cycle(p_source_id uuid, p_client_service_id uuid, p_start_date date, p_end_date date, p_programming_verified boolean, p_confirmation text) to service_role;
revoke all on function public.comercial_lote(p_session text, p_ultimo bigint) from public, anon, authenticated, service_role;
grant execute on function public.comercial_lote(p_session text, p_ultimo bigint) to postgres;
grant execute on function public.comercial_lote(p_session text, p_ultimo bigint) to service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
grant execute on function public.handle_new_user() to postgres;
grant execute on function public.handle_new_user() to authenticated;
grant execute on function public.handle_new_user() to service_role;
revoke all on function public.comercial_avaliar(l comercial_leads) from public, anon, authenticated, service_role;
grant execute on function public.comercial_avaliar(l comercial_leads) to postgres;
grant execute on function public.comercial_avaliar(l comercial_leads) to service_role;
revoke all on function public.app_current_role() from public, anon, authenticated, service_role;
grant execute on function public.app_current_role() to postgres;
grant execute on function public.app_current_role() to authenticated;
grant execute on function public.app_current_role() to service_role;
revoke all on function public.app_is_manager() from public, anon, authenticated, service_role;
grant execute on function public.app_is_manager() to postgres;
grant execute on function public.app_is_manager() to authenticated;
grant execute on function public.app_is_manager() to service_role;
revoke all on function public.app_is_admin() from public, anon, authenticated, service_role;
grant execute on function public.app_is_admin() to postgres;
grant execute on function public.app_is_admin() to authenticated;
grant execute on function public.app_is_admin() to service_role;
revoke all on function public.update_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.update_updated_at() to public;
grant execute on function public.update_updated_at() to postgres;
grant execute on function public.update_updated_at() to anon;
grant execute on function public.update_updated_at() to authenticated;
grant execute on function public.update_updated_at() to service_role;
revoke all on function public.comercial_tel_chave(p text) from public, anon, authenticated, service_role;
grant execute on function public.comercial_tel_chave(p text) to postgres;
grant execute on function public.comercial_tel_chave(p text) to service_role;
revoke all on function public.comercial_formulario(p_response_id text, p_dados jsonb, p_session_hint text, p_payload jsonb) from public, anon, authenticated, service_role;
grant execute on function public.comercial_formulario(p_response_id text, p_dados jsonb, p_session_hint text, p_payload jsonb) to postgres;
grant execute on function public.comercial_formulario(p_response_id text, p_dados jsonb, p_session_hint text, p_payload jsonb) to service_role;
revoke all on function public.comercial_pontuar(l comercial_leads) from public, anon, authenticated, service_role;
grant execute on function public.comercial_pontuar(l comercial_leads) to postgres;
grant execute on function public.comercial_pontuar(l comercial_leads) to service_role;
revoke all on function public.app_is_active_user() from public, anon, authenticated, service_role;
grant execute on function public.app_is_active_user() to postgres;
grant execute on function public.app_is_active_user() to authenticated;
grant execute on function public.app_is_active_user() to service_role;
revoke all on function public.app_validate_work_item_links() from public, anon, authenticated, service_role;
grant execute on function public.app_validate_work_item_links() to public;
grant execute on function public.app_validate_work_item_links() to postgres;
grant execute on function public.app_validate_work_item_links() to anon;
grant execute on function public.app_validate_work_item_links() to authenticated;
grant execute on function public.app_validate_work_item_links() to service_role;
revoke all on function public.app_validate_calendar_links() from public, anon, authenticated, service_role;
grant execute on function public.app_validate_calendar_links() to public;
grant execute on function public.app_validate_calendar_links() to postgres;
grant execute on function public.app_validate_calendar_links() to anon;
grant execute on function public.app_validate_calendar_links() to authenticated;
grant execute on function public.app_validate_calendar_links() to service_role;
revoke all on function public.sync_calendar_event_pauta() from public, anon, authenticated, service_role;
grant execute on function public.sync_calendar_event_pauta() to postgres;
grant execute on function public.sync_calendar_event_pauta() to authenticated;
grant execute on function public.sync_calendar_event_pauta() to service_role;
revoke all on function public.open_monthly_pauta(p_board_id uuid, p_name text, p_reference_month date, p_magic_number_date date, p_scheduled_until_date date, p_client_ids uuid[], p_confirmation text) from public, anon, authenticated, service_role;
grant execute on function public.open_monthly_pauta(p_board_id uuid, p_name text, p_reference_month date, p_magic_number_date date, p_scheduled_until_date date, p_client_ids uuid[], p_confirmation text) to postgres;
grant execute on function public.open_monthly_pauta(p_board_id uuid, p_name text, p_reference_month date, p_magic_number_date date, p_scheduled_until_date date, p_client_ids uuid[], p_confirmation text) to authenticated;
grant execute on function public.open_monthly_pauta(p_board_id uuid, p_name text, p_reference_month date, p_magic_number_date date, p_scheduled_until_date date, p_client_ids uuid[], p_confirmation text) to service_role;
revoke all on function public.pauta_log_event(p_pauta_id uuid, p_board_id uuid, p_actor_id uuid, p_action text, p_target_type text, p_target_id uuid, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb) from public, anon, authenticated, service_role;
grant execute on function public.pauta_log_event(p_pauta_id uuid, p_board_id uuid, p_actor_id uuid, p_action text, p_target_type text, p_target_id uuid, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb) to postgres;
grant execute on function public.pauta_log_event(p_pauta_id uuid, p_board_id uuid, p_actor_id uuid, p_action text, p_target_type text, p_target_id uuid, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb) to service_role;
grant execute on function public.pauta_log_event(p_pauta_id uuid, p_board_id uuid, p_actor_id uuid, p_action text, p_target_type text, p_target_id uuid, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb) to authenticated;
revoke all on function public.app_log_feed_board_created() from public, anon, authenticated, service_role;
grant execute on function public.app_log_feed_board_created() to public;
grant execute on function public.app_log_feed_board_created() to postgres;
grant execute on function public.app_log_feed_board_created() to anon;
grant execute on function public.app_log_feed_board_created() to authenticated;
grant execute on function public.app_log_feed_board_created() to service_role;
revoke all on function public.update_pauta_settings(p_pauta_id uuid, p_name text, p_magic_number_date date, p_scheduled_until_date date) from public, anon, authenticated, service_role;
grant execute on function public.update_pauta_settings(p_pauta_id uuid, p_name text, p_magic_number_date date, p_scheduled_until_date date) to postgres;
grant execute on function public.update_pauta_settings(p_pauta_id uuid, p_name text, p_magic_number_date date, p_scheduled_until_date date) to authenticated;
grant execute on function public.update_pauta_settings(p_pauta_id uuid, p_name text, p_magic_number_date date, p_scheduled_until_date date) to service_role;
revoke all on function public.guard_active_pauta_work_item_requires_pauta() from public, anon, authenticated, service_role;
grant execute on function public.guard_active_pauta_work_item_requires_pauta() to postgres;
grant execute on function public.guard_active_pauta_work_item_requires_pauta() to authenticated;
grant execute on function public.guard_active_pauta_work_item_requires_pauta() to service_role;
revoke all on function public.add_clients_to_pauta(p_pauta_id uuid, p_client_ids uuid[], p_confirmation text) from public, anon, authenticated, service_role;
grant execute on function public.add_clients_to_pauta(p_pauta_id uuid, p_client_ids uuid[], p_confirmation text) to postgres;
grant execute on function public.add_clients_to_pauta(p_pauta_id uuid, p_client_ids uuid[], p_confirmation text) to authenticated;
grant execute on function public.add_clients_to_pauta(p_pauta_id uuid, p_client_ids uuid[], p_confirmation text) to service_role;
revoke all on function public.adopt_legacy_cards_to_pauta(p_pauta_id uuid, p_mapping jsonb, p_confirmation text) from public, anon, authenticated, service_role;
grant execute on function public.adopt_legacy_cards_to_pauta(p_pauta_id uuid, p_mapping jsonb, p_confirmation text) to postgres;
grant execute on function public.adopt_legacy_cards_to_pauta(p_pauta_id uuid, p_mapping jsonb, p_confirmation text) to authenticated;
grant execute on function public.adopt_legacy_cards_to_pauta(p_pauta_id uuid, p_mapping jsonb, p_confirmation text) to service_role;
revoke all on function public.set_avisos_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.set_avisos_updated_at() to public;
grant execute on function public.set_avisos_updated_at() to postgres;
grant execute on function public.set_avisos_updated_at() to anon;
grant execute on function public.set_avisos_updated_at() to authenticated;
grant execute on function public.set_avisos_updated_at() to service_role;
revoke all on function public.detach_pauta_demand(p_pauta_id uuid, p_work_item_id uuid, p_confirmation text) from public, anon, authenticated, service_role;
grant execute on function public.detach_pauta_demand(p_pauta_id uuid, p_work_item_id uuid, p_confirmation text) to postgres;
grant execute on function public.detach_pauta_demand(p_pauta_id uuid, p_work_item_id uuid, p_confirmation text) to authenticated;
grant execute on function public.detach_pauta_demand(p_pauta_id uuid, p_work_item_id uuid, p_confirmation text) to service_role;
revoke all on function public.set_team_members_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.set_team_members_updated_at() to public;
grant execute on function public.set_team_members_updated_at() to postgres;
grant execute on function public.set_team_members_updated_at() to anon;
grant execute on function public.set_team_members_updated_at() to authenticated;
grant execute on function public.set_team_members_updated_at() to service_role;
revoke all on function public.remove_client_from_pauta(p_pauta_id uuid, p_client_id uuid, p_confirmation text) from public, anon, authenticated, service_role;
grant execute on function public.remove_client_from_pauta(p_pauta_id uuid, p_client_id uuid, p_confirmation text) to postgres;
grant execute on function public.remove_client_from_pauta(p_pauta_id uuid, p_client_id uuid, p_confirmation text) to authenticated;
grant execute on function public.remove_client_from_pauta(p_pauta_id uuid, p_client_id uuid, p_confirmation text) to service_role;
revoke all on function public.v8_sync_assignment_from_work_item() from public, anon, authenticated, service_role;
grant execute on function public.v8_sync_assignment_from_work_item() to postgres;
grant execute on function public.v8_sync_assignment_from_work_item() to authenticated;
grant execute on function public.v8_sync_assignment_from_work_item() to service_role;
revoke all on function public.v8_log_assignment_event(p_assignment_id uuid, p_work_item_id uuid, p_pauta_id uuid, p_board_id uuid, p_board_column_id uuid, p_actor_id uuid, p_action text, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb) from public, anon, authenticated, service_role;
grant execute on function public.v8_log_assignment_event(p_assignment_id uuid, p_work_item_id uuid, p_pauta_id uuid, p_board_id uuid, p_board_column_id uuid, p_actor_id uuid, p_action text, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb) to postgres;
grant execute on function public.v8_log_assignment_event(p_assignment_id uuid, p_work_item_id uuid, p_pauta_id uuid, p_board_id uuid, p_board_column_id uuid, p_actor_id uuid, p_action text, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb) to authenticated;
grant execute on function public.v8_log_assignment_event(p_assignment_id uuid, p_work_item_id uuid, p_pauta_id uuid, p_board_id uuid, p_board_column_id uuid, p_actor_id uuid, p_action text, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb) to service_role;
revoke all on function public.delete_board_preserve_demands(p_board_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_board_preserve_demands(p_board_id uuid) to postgres;
grant execute on function public.delete_board_preserve_demands(p_board_id uuid) to authenticated;
grant execute on function public.delete_board_preserve_demands(p_board_id uuid) to service_role;
revoke all on function public.recalculate_work_item_global_status(p_work_item_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.recalculate_work_item_global_status(p_work_item_id uuid) to postgres;
grant execute on function public.recalculate_work_item_global_status(p_work_item_id uuid) to authenticated;
grant execute on function public.recalculate_work_item_global_status(p_work_item_id uuid) to service_role;
revoke all on function public.seed_board_default_columns() from public, anon, authenticated, service_role;
grant execute on function public.seed_board_default_columns() to postgres;
grant execute on function public.seed_board_default_columns() to authenticated;
grant execute on function public.seed_board_default_columns() to service_role;
revoke all on function public.comercial_lembrete_marcar(p_reuniao uuid, p_tipo text) from public, anon, authenticated, service_role;
grant execute on function public.comercial_lembrete_marcar(p_reuniao uuid, p_tipo text) to postgres;
grant execute on function public.comercial_lembrete_marcar(p_reuniao uuid, p_tipo text) to service_role;
revoke all on function public.delete_board_column_move_cards(p_column_id uuid, p_target_column_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_board_column_move_cards(p_column_id uuid, p_target_column_id uuid) to postgres;
grant execute on function public.delete_board_column_move_cards(p_column_id uuid, p_target_column_id uuid) to authenticated;
grant execute on function public.delete_board_column_move_cards(p_column_id uuid, p_target_column_id uuid) to service_role;
revoke all on function public.comercial_lembretes_pendentes() from public, anon, authenticated, service_role;
grant execute on function public.comercial_lembretes_pendentes() to postgres;
grant execute on function public.comercial_lembretes_pendentes() to service_role;
revoke all on function public.seed_project_step_statuses_for_work_item() from public, anon, authenticated, service_role;
grant execute on function public.seed_project_step_statuses_for_work_item() to postgres;
grant execute on function public.seed_project_step_statuses_for_work_item() to authenticated;
grant execute on function public.seed_project_step_statuses_for_work_item() to service_role;
revoke all on function public.touch_project_step_statuses_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.touch_project_step_statuses_updated_at() to public;
grant execute on function public.touch_project_step_statuses_updated_at() to postgres;
grant execute on function public.touch_project_step_statuses_updated_at() to anon;
grant execute on function public.touch_project_step_statuses_updated_at() to authenticated;
grant execute on function public.touch_project_step_statuses_updated_at() to service_role;
revoke all on function public.comercial_resumo_semana(p_since date, p_until date) from public, anon, authenticated, service_role;
grant execute on function public.comercial_resumo_semana(p_since date, p_until date) to postgres;
grant execute on function public.comercial_resumo_semana(p_since date, p_until date) to service_role;
revoke all on function public.touch_pautas_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.touch_pautas_updated_at() to public;
grant execute on function public.touch_pautas_updated_at() to postgres;
grant execute on function public.touch_pautas_updated_at() to anon;
grant execute on function public.touch_pautas_updated_at() to authenticated;
grant execute on function public.touch_pautas_updated_at() to service_role;
revoke all on function public.sync_cycle_schedule_requirement_from_calendar_event() from public, anon, authenticated, service_role;
grant execute on function public.sync_cycle_schedule_requirement_from_calendar_event() to postgres;
grant execute on function public.sync_cycle_schedule_requirement_from_calendar_event() to authenticated;
grant execute on function public.sync_cycle_schedule_requirement_from_calendar_event() to service_role;
revoke all on function public.traffic_brl(v numeric) from public, anon, authenticated, service_role;
grant execute on function public.traffic_brl(v numeric) to public;
grant execute on function public.traffic_brl(v numeric) to postgres;
grant execute on function public.traffic_brl(v numeric) to anon;
grant execute on function public.traffic_brl(v numeric) to authenticated;
grant execute on function public.traffic_brl(v numeric) to service_role;
revoke all on function public.traffic_indicador(ind text) from public, anon, authenticated, service_role;
grant execute on function public.traffic_indicador(ind text) to public;
grant execute on function public.traffic_indicador(ind text) to postgres;
grant execute on function public.traffic_indicador(ind text) to anon;
grant execute on function public.traffic_indicador(ind text) to authenticated;
grant execute on function public.traffic_indicador(ind text) to service_role;
revoke all on function public.traffic_alertas_base(p_ref date) from public, anon, authenticated, service_role;
grant execute on function public.traffic_alertas_base(p_ref date) to postgres;
grant execute on function public.traffic_alertas_base(p_ref date) to service_role;
revoke all on function public.meta_write_token() from public, anon, authenticated, service_role;
grant execute on function public.meta_write_token() to postgres;
grant execute on function public.meta_write_token() to service_role;
revoke all on function public.traffic_alertas(p_ref date) from public, anon, authenticated, service_role;
grant execute on function public.traffic_alertas(p_ref date) to postgres;
grant execute on function public.traffic_alertas(p_ref date) to service_role;
revoke all on function public.traffic_sugestoes(d date, base jsonb) from public, anon, authenticated, service_role;
grant execute on function public.traffic_sugestoes(d date, base jsonb) to postgres;
grant execute on function public.traffic_sugestoes(d date, base jsonb) to service_role;
revoke all on function public.touch_pauta_members_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.touch_pauta_members_updated_at() to public;
grant execute on function public.touch_pauta_members_updated_at() to postgres;
grant execute on function public.touch_pauta_members_updated_at() to anon;
grant execute on function public.touch_pauta_members_updated_at() to authenticated;
grant execute on function public.touch_pauta_members_updated_at() to service_role;
revoke all on function public.pauta_current_active_actor() from public, anon, authenticated, service_role;
grant execute on function public.pauta_current_active_actor() to postgres;
grant execute on function public.pauta_current_active_actor() to service_role;
grant execute on function public.pauta_current_active_actor() to authenticated;
revoke all on function public.pauta_management_actor() from public, anon, authenticated, service_role;
grant execute on function public.pauta_management_actor() to postgres;
grant execute on function public.pauta_management_actor() to service_role;
grant execute on function public.pauta_management_actor() to authenticated;
revoke all on function public.pauta_create_main_card_core(p_pauta_id uuid, p_client_id uuid, p_actor_id uuid, p_source text) from public, anon, authenticated, service_role;
grant execute on function public.pauta_create_main_card_core(p_pauta_id uuid, p_client_id uuid, p_actor_id uuid, p_source text) to postgres;
grant execute on function public.pauta_create_main_card_core(p_pauta_id uuid, p_client_id uuid, p_actor_id uuid, p_source text) to service_role;
grant execute on function public.pauta_create_main_card_core(p_pauta_id uuid, p_client_id uuid, p_actor_id uuid, p_source text) to authenticated;
revoke all on function public.preview_pauta_client_additions(p_pauta_id uuid, p_client_ids uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.preview_pauta_client_additions(p_pauta_id uuid, p_client_ids uuid[]) to postgres;
grant execute on function public.preview_pauta_client_additions(p_pauta_id uuid, p_client_ids uuid[]) to authenticated;
grant execute on function public.preview_pauta_client_additions(p_pauta_id uuid, p_client_ids uuid[]) to service_role;
revoke all on function public.add_clients_to_pauta_v8(p_pauta_id uuid, p_clients jsonb, p_confirmation text) from public, anon, authenticated, service_role;
grant execute on function public.add_clients_to_pauta_v8(p_pauta_id uuid, p_clients jsonb, p_confirmation text) to postgres;
grant execute on function public.add_clients_to_pauta_v8(p_pauta_id uuid, p_clients jsonb, p_confirmation text) to authenticated;
grant execute on function public.add_clients_to_pauta_v8(p_pauta_id uuid, p_clients jsonb, p_confirmation text) to service_role;
revoke all on function public.set_work_item_board_assignment_completion(p_assignment_id uuid, p_completed boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.set_work_item_board_assignment_completion(p_assignment_id uuid, p_completed boolean, p_note text) to postgres;
grant execute on function public.set_work_item_board_assignment_completion(p_assignment_id uuid, p_completed boolean, p_note text) to authenticated;
grant execute on function public.set_work_item_board_assignment_completion(p_assignment_id uuid, p_completed boolean, p_note text) to service_role;
revoke all on function public.distribute_existing_pauta_demands(p_pauta_id uuid, p_work_item_ids jsonb, p_targets jsonb, p_confirmation text) from public, anon, authenticated, service_role;
grant execute on function public.distribute_existing_pauta_demands(p_pauta_id uuid, p_work_item_ids jsonb, p_targets jsonb, p_confirmation text) to postgres;
grant execute on function public.distribute_existing_pauta_demands(p_pauta_id uuid, p_work_item_ids jsonb, p_targets jsonb, p_confirmation text) to authenticated;
grant execute on function public.distribute_existing_pauta_demands(p_pauta_id uuid, p_work_item_ids jsonb, p_targets jsonb, p_confirmation text) to service_role;
revoke all on function public.pauta_dependency_summary(p_pauta_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.pauta_dependency_summary(p_pauta_id uuid) to postgres;
grant execute on function public.pauta_dependency_summary(p_pauta_id uuid) to authenticated;
grant execute on function public.pauta_dependency_summary(p_pauta_id uuid) to service_role;
revoke all on function public.get_pauta_management_snapshot(p_pauta_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_pauta_management_snapshot(p_pauta_id uuid) to postgres;
grant execute on function public.get_pauta_management_snapshot(p_pauta_id uuid) to authenticated;
grant execute on function public.get_pauta_management_snapshot(p_pauta_id uuid) to service_role;
revoke all on function public.preview_legacy_pauta_import(p_pauta_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.preview_legacy_pauta_import(p_pauta_id uuid) to postgres;
grant execute on function public.preview_legacy_pauta_import(p_pauta_id uuid) to service_role;
grant execute on function public.preview_legacy_pauta_import(p_pauta_id uuid) to authenticated;
revoke all on function public.delete_empty_pauta(p_pauta_id uuid, p_confirmation text) from public, anon, authenticated, service_role;
grant execute on function public.delete_empty_pauta(p_pauta_id uuid, p_confirmation text) to postgres;
grant execute on function public.delete_empty_pauta(p_pauta_id uuid, p_confirmation text) to service_role;
revoke all on function public.create_pauta_demand(p_pauta_id uuid, p_client_id uuid, p_board_column_id uuid, p_title text, p_client_service_id uuid, p_responsible_id uuid, p_priority text, p_internal_deadline date, p_final_deadline date, p_drive_link text, p_notes text) from public, anon, authenticated, service_role;
grant execute on function public.create_pauta_demand(p_pauta_id uuid, p_client_id uuid, p_board_column_id uuid, p_title text, p_client_service_id uuid, p_responsible_id uuid, p_priority text, p_internal_deadline date, p_final_deadline date, p_drive_link text, p_notes text) to postgres;
grant execute on function public.create_pauta_demand(p_pauta_id uuid, p_client_id uuid, p_board_column_id uuid, p_title text, p_client_service_id uuid, p_responsible_id uuid, p_priority text, p_internal_deadline date, p_final_deadline date, p_drive_link text, p_notes text) to authenticated;
grant execute on function public.create_pauta_demand(p_pauta_id uuid, p_client_id uuid, p_board_column_id uuid, p_title text, p_client_service_id uuid, p_responsible_id uuid, p_priority text, p_internal_deadline date, p_final_deadline date, p_drive_link text, p_notes text) to service_role;
revoke all on function public.v8_assignment_after_change() from public, anon, authenticated, service_role;
grant execute on function public.v8_assignment_after_change() to postgres;
grant execute on function public.v8_assignment_after_change() to authenticated;
grant execute on function public.v8_assignment_after_change() to service_role;
revoke all on function public.v8_assignment_is_complete(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.v8_assignment_is_complete(p_status text) to public;
grant execute on function public.v8_assignment_is_complete(p_status text) to postgres;
grant execute on function public.v8_assignment_is_complete(p_status text) to anon;
grant execute on function public.v8_assignment_is_complete(p_status text) to authenticated;
grant execute on function public.v8_assignment_is_complete(p_status text) to service_role;
revoke all on function public.change_pauta_lifecycle(p_pauta_id uuid, p_action text, p_confirmation text) from public, anon, authenticated, service_role;
grant execute on function public.change_pauta_lifecycle(p_pauta_id uuid, p_action text, p_confirmation text) to postgres;
grant execute on function public.change_pauta_lifecycle(p_pauta_id uuid, p_action text, p_confirmation text) to authenticated;
grant execute on function public.change_pauta_lifecycle(p_pauta_id uuid, p_action text, p_confirmation text) to service_role;
revoke all on function public.update_pauta_member_target_date(p_member_id uuid, p_target_date date) from public, anon, authenticated, service_role;
grant execute on function public.update_pauta_member_target_date(p_member_id uuid, p_target_date date) to postgres;
grant execute on function public.update_pauta_member_target_date(p_member_id uuid, p_target_date date) to authenticated;
grant execute on function public.update_pauta_member_target_date(p_member_id uuid, p_target_date date) to service_role;
revoke all on function public.remove_pauta_clients_batch(p_pauta_id uuid, p_client_ids uuid[], p_confirmation text) from public, anon, authenticated, service_role;
grant execute on function public.remove_pauta_clients_batch(p_pauta_id uuid, p_client_ids uuid[], p_confirmation text) to postgres;
grant execute on function public.remove_pauta_clients_batch(p_pauta_id uuid, p_client_ids uuid[], p_confirmation text) to authenticated;
grant execute on function public.remove_pauta_clients_batch(p_pauta_id uuid, p_client_ids uuid[], p_confirmation text) to service_role;
revoke all on function public.remove_pauta_demands_batch(p_pauta_id uuid, p_work_item_ids uuid[], p_confirmation text) from public, anon, authenticated, service_role;
grant execute on function public.remove_pauta_demands_batch(p_pauta_id uuid, p_work_item_ids uuid[], p_confirmation text) to postgres;
grant execute on function public.remove_pauta_demands_batch(p_pauta_id uuid, p_work_item_ids uuid[], p_confirmation text) to authenticated;
grant execute on function public.remove_pauta_demands_batch(p_pauta_id uuid, p_work_item_ids uuid[], p_confirmation text) to service_role;
revoke all on function public.create_and_distribute_pauta_demands(p_pauta_id uuid, p_rows jsonb, p_targets jsonb, p_confirmation text) from public, anon, authenticated, service_role;
grant execute on function public.create_and_distribute_pauta_demands(p_pauta_id uuid, p_rows jsonb, p_targets jsonb, p_confirmation text) to postgres;
grant execute on function public.create_and_distribute_pauta_demands(p_pauta_id uuid, p_rows jsonb, p_targets jsonb, p_confirmation text) to authenticated;
grant execute on function public.create_and_distribute_pauta_demands(p_pauta_id uuid, p_rows jsonb, p_targets jsonb, p_confirmation text) to service_role;
revoke all on function public.move_work_item_board_assignment(p_assignment_id uuid, p_target_column_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.move_work_item_board_assignment(p_assignment_id uuid, p_target_column_id uuid) to postgres;
grant execute on function public.move_work_item_board_assignment(p_assignment_id uuid, p_target_column_id uuid) to authenticated;
grant execute on function public.move_work_item_board_assignment(p_assignment_id uuid, p_target_column_id uuid) to service_role;
revoke all on function public.v9_prepare_simple_assignment_card() from public, anon, authenticated, service_role;
grant execute on function public.v9_prepare_simple_assignment_card() to public;
grant execute on function public.v9_prepare_simple_assignment_card() to postgres;
grant execute on function public.v9_prepare_simple_assignment_card() to anon;
grant execute on function public.v9_prepare_simple_assignment_card() to authenticated;
grant execute on function public.v9_prepare_simple_assignment_card() to service_role;
revoke all on function public.set_calendar_event_completion(p_event_id uuid, p_completed boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.set_calendar_event_completion(p_event_id uuid, p_completed boolean, p_note text) to postgres;
grant execute on function public.set_calendar_event_completion(p_event_id uuid, p_completed boolean, p_note text) to authenticated;
grant execute on function public.set_calendar_event_completion(p_event_id uuid, p_completed boolean, p_note text) to service_role;
revoke all on function public.set_work_item_completion(p_work_item_id uuid, p_completed boolean, p_complete_assignments boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.set_work_item_completion(p_work_item_id uuid, p_completed boolean, p_complete_assignments boolean, p_note text) to postgres;
grant execute on function public.set_work_item_completion(p_work_item_id uuid, p_completed boolean, p_complete_assignments boolean, p_note text) to authenticated;
grant execute on function public.set_work_item_completion(p_work_item_id uuid, p_completed boolean, p_complete_assignments boolean, p_note text) to service_role;
revoke all on function public.remove_pauta_extra_demands_v92c(p_pauta_id uuid, p_work_item_ids uuid[], p_confirmation text) from public, anon, authenticated, service_role;
grant execute on function public.remove_pauta_extra_demands_v92c(p_pauta_id uuid, p_work_item_ids uuid[], p_confirmation text) to postgres;
grant execute on function public.remove_pauta_extra_demands_v92c(p_pauta_id uuid, p_work_item_ids uuid[], p_confirmation text) to authenticated;
grant execute on function public.remove_pauta_extra_demands_v92c(p_pauta_id uuid, p_work_item_ids uuid[], p_confirmation text) to service_role;
revoke all on function public.remove_work_item_board_assignment(p_assignment_id uuid, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.remove_work_item_board_assignment(p_assignment_id uuid, p_note text) to postgres;
grant execute on function public.remove_work_item_board_assignment(p_assignment_id uuid, p_note text) to authenticated;
grant execute on function public.remove_work_item_board_assignment(p_assignment_id uuid, p_note text) to service_role;
revoke all on function public.meta_sync_secret() from public, anon, authenticated, service_role;
grant execute on function public.meta_sync_secret() to postgres;
grant execute on function public.meta_sync_secret() to service_role;
revoke all on function public.meta_enqueue_sync(p_days integer, p_mode text) from public, anon, authenticated, service_role;
grant execute on function public.meta_enqueue_sync(p_days integer, p_mode text) to postgres;
grant execute on function public.meta_enqueue_sync(p_days integer, p_mode text) to service_role;
