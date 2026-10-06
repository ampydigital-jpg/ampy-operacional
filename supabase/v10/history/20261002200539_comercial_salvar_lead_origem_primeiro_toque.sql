-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

-- Origem, anúncio e campanha ficam com o primeiro contato (não são sobrescritos por mensagens seguintes).
CREATE OR REPLACE FUNCTION public.comercial_salvar_lead(p_session text, p_dados jsonb)
 RETURNS comercial_leads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l public.comercial_leads;
  s jsonb;
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
    marketing_hoje = coalesce(nullif(p_dados->>'marketing_hoje',''), marketing_hoje),
    trafego_pago = coalesce(nullif(p_dados->>'trafego_pago',''), trafego_pago),
    investimento_faixa = coalesce(nullif(p_dados->>'investimento_faixa',''), investimento_faixa),
    dor = coalesce(nullif(p_dados->>'dor',''), dor),
    decisor = coalesce(nullif(p_dados->>'decisor',''), decisor),
    urgencia = coalesce(nullif(p_dados->>'urgencia',''), urgencia),
    email = coalesce(nullif(lower(trim(p_dados->>'email')),''), email),
    telefone = coalesce(nullif(p_dados->>'telefone',''), telefone),
    origem = coalesce(origem, nullif(p_dados->>'origem','')),
    ad_id = coalesce(ad_id, nullif(p_dados->>'ad_id','')),
    ctwa_clid = coalesce(ctwa_clid, nullif(p_dados->>'ctwa_clid','')),
    campanha = coalesce(campanha, nullif(p_dados->>'campanha','')),
    resumo = coalesce(nullif(p_dados->>'resumo',''), resumo),
    pode_agendar = true
  where session_id = p_session
  returning * into l;

  s := comercial_pontuar(l);
  update comercial_leads set
    score = (s->>'score')::int,
    temperatura = s->>'temperatura',
    score_detalhe = s
  where id = l.id
  returning * into l;
  return l;
end $function$;
