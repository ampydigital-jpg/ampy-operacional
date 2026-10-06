-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

alter table public.comercial_leads add column if not exists colaboradores int check (colaboradores >= 0);

create or replace function public.comercial_salvar_lead(p_session text, p_dados jsonb)
returns public.comercial_leads language plpgsql security definer set search_path = public as $$
declare
  l public.comercial_leads;
  alto boolean;
  dec_ok boolean;
  urg_ok boolean;
  colab int := case when coalesce(p_dados->>'colaboradores','') ~ '^\d+$' then (p_dados->>'colaboradores')::int end;
begin
  insert into comercial_leads (session_id, canal, origem, telefone, pode_agendar)
  values (p_session,
          coalesce(nullif(p_dados->>'canal',''), 'whatsapp'),
          nullif(p_dados->>'origem',''),
          nullif(p_dados->>'telefone',''),
          true)
  on conflict (session_id) do nothing;

  update comercial_leads set
    nome = coalesce(nullif(p_dados->>'nome',''), nome),
    empresa = coalesce(nullif(p_dados->>'empresa',''), empresa),
    segmento = coalesce(nullif(p_dados->>'segmento',''), segmento),
    cidade = coalesce(nullif(p_dados->>'cidade',''), cidade),
    colaboradores = coalesce(colab, colaboradores),
    faturamento_faixa = coalesce(nullif(p_dados->>'faturamento_faixa',''), faturamento_faixa),
    investe_marketing = coalesce(nullif(p_dados->>'investe_marketing',''), investe_marketing),
    dor = coalesce(nullif(p_dados->>'dor',''), dor),
    decisor = coalesce(nullif(p_dados->>'decisor',''), decisor),
    urgencia = coalesce(nullif(p_dados->>'urgencia',''), urgencia),
    email = coalesce(nullif(lower(trim(p_dados->>'email')),''), email),
    telefone = coalesce(nullif(p_dados->>'telefone',''), telefone),
    origem = coalesce(nullif(p_dados->>'origem',''), origem),
    ad_id = coalesce(nullif(p_dados->>'ad_id',''), ad_id),
    ctwa_clid = coalesce(nullif(p_dados->>'ctwa_clid',''), ctwa_clid),
    campanha = coalesce(nullif(p_dados->>'campanha',''), campanha),
    resumo = coalesce(nullif(p_dados->>'resumo',''), resumo),
    pode_agendar = true
  where session_id = p_session
  returning * into l;

  if l.faturamento_faixa is not null then
    alto := l.faturamento_faixa in ('50k_100k','acima_100k');
    dec_ok := coalesce(l.decisor in ('sim','participa'), false);
    urg_ok := coalesce(l.urgencia in ('imediato','30_dias'), false);
    l.temperatura := case when not alto then 'frio' when dec_ok and urg_ok then 'quente' else 'morno' end;
    update comercial_leads set temperatura = l.temperatura where id = l.id returning * into l;
  end if;
  return l;
end $$;

revoke all on function public.comercial_salvar_lead(text, jsonb) from public, anon, authenticated;

revoke all on function public.comercial_agendar(text, timestamptz, text, text) from public, anon, authenticated;
