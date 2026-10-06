-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

-- Reclassifica o lead a cada atualização: frio pode voltar a morno/quente se o lead corrigir os dados.
create or replace function public.comercial_salvar_lead(p_session text, p_dados jsonb)
returns public.comercial_leads language plpgsql security definer set search_path = public as $$
declare
  l public.comercial_leads;
  alto boolean;
begin
  insert into comercial_leads (session_id, canal, origem, telefone)
  values (p_session,
          coalesce(nullif(p_dados->>'canal',''), 'whatsapp'),
          nullif(p_dados->>'origem',''),
          nullif(p_dados->>'telefone',''))
  on conflict (session_id) do nothing;

  update comercial_leads set
    nome = coalesce(nullif(p_dados->>'nome',''), nome),
    empresa = coalesce(nullif(p_dados->>'empresa',''), empresa),
    segmento = coalesce(nullif(p_dados->>'segmento',''), segmento),
    cidade = coalesce(nullif(p_dados->>'cidade',''), cidade),
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
    resumo = coalesce(nullif(p_dados->>'resumo',''), resumo)
  where session_id = p_session
  returning * into l;

  if l.faturamento_faixa is not null then
    alto := l.faturamento_faixa in ('50k_100k','acima_100k');
    if not alto then
      l.temperatura := 'frio'; l.pode_agendar := false;
    elsif l.decisor in ('sim','participa') and l.urgencia in ('imediato','30_dias') then
      l.temperatura := 'quente'; l.pode_agendar := true;
    else
      l.temperatura := 'morno'; l.pode_agendar := l.decisor in ('sim','participa');
    end if;
    update comercial_leads set
      temperatura = l.temperatura,
      pode_agendar = l.pode_agendar,
      status = case
        when status in ('agendado','compareceu','nao_compareceu','humano') then status
        when l.temperatura = 'frio' then 'desqualificado'
        when l.pode_agendar then 'qualificado'
        else 'em_conversa' end
    where id = l.id
    returning * into l;
  end if;
  return l;
end $$;

revoke all on function public.comercial_salvar_lead(text, jsonb) from public, anon, authenticated;
