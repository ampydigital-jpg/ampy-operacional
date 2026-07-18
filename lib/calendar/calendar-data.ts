export type CalendarReferenceKind = 'holiday' | 'opportunity'
export type CalendarReferenceCategory =
  | 'national_holiday' | 'optional_holiday' | 'commercial'
  | 'marketing' | 'campaign' | 'regional'

export type CalendarReference = {
  id:string; kind:CalendarReferenceKind; category:CalendarReferenceCategory;
  date:string; title:string; sourceLabel:string; potential?:string; segment?:string;
}

const rows = String.raw`
2026-01-01|Confraternização Universal|national_holiday|Feriado nacional|Alto
2026-04-03|Sexta-feira Santa|national_holiday|Feriado nacional|Alto
2026-04-21|Tiradentes|national_holiday|Feriado nacional|Alto
2026-05-01|Dia do Trabalho|national_holiday|Feriado nacional|Alto
2026-09-07|Independência do Brasil|national_holiday|Feriado nacional|Muito alto
2026-10-12|Nossa Senhora Aparecida|national_holiday|Feriado nacional|Máximo
2026-11-02|Finados|national_holiday|Feriado nacional|Alto
2026-11-15|Proclamação da República|national_holiday|Feriado nacional|
2026-11-20|Dia Nacional de Zumbi e da Consciência Negra|national_holiday|Feriado nacional|Alto
2026-12-25|Natal|national_holiday|Feriado nacional|Máximo
2026-02-16|Carnaval — segunda-feira|optional_holiday|Ponto facultativo|Máximo
2026-02-17|Carnaval|optional_holiday|Ponto facultativo|Máximo
2026-02-18|Quarta-feira de Cinzas — até 14h|optional_holiday|Ponto facultativo|
2026-04-20|Véspera de Tiradentes|optional_holiday|Ponto facultativo|
2026-06-04|Corpus Christi|optional_holiday|Ponto facultativo|Alto
2026-06-05|Pós Corpus Christi|optional_holiday|Ponto facultativo|
2026-10-28|Dia do Servidor Público Federal|optional_holiday|Ponto facultativo|
2026-12-24|Véspera de Natal — após 13h|optional_holiday|Ponto facultativo|Muito alto
2026-12-31|Véspera de Ano-Novo — após 13h|optional_holiday|Ponto facultativo|Muito alto
2026-01-07|Dia do Leitor|marketing|Calendário de Marketing 2026|Nicho|Editoras
2026-01-08|Dia do Fotógrafo|marketing|Calendário de Marketing 2026|Nicho|Criativo
2026-01-20|Dia do Farmacêutico|marketing|Calendário de Marketing 2026|Nicho|Saúde
2026-01-20|São Sebastião|regional|Calendário de Marketing 2026|Regional|RJ
2026-01-25|Aniversário de São Paulo|regional|Calendário de Marketing 2026|Regional|SP
2026-01-30|Dia da Saudade|marketing|Calendário de Marketing 2026|Conteúdo|
2026-01-30|Dia do Quadrinho Nacional|marketing|Calendário de Marketing 2026|Conteúdo|
2026-01-01|Janeiro Branco|campaign|Campanha mensal|Muito alto|Saúde
2026-01-05|Volta às aulas|commercial|Campanha sazonal|Muito alto|Educação
2026-01-05|Férias e verão|campaign|Campanha mensal|Muito alto|
2026-02-02|Dia de Iemanjá|regional|Calendário de Marketing 2026|Regional|BA
2026-02-14|Esquenta de Carnaval|commercial|Calendário de Marketing 2026|Máximo|
2026-02-18|Início da Quaresma|marketing|Calendário de Marketing 2026|Nicho|Pescados/Religioso
2026-02-19|Dia do Esportista|marketing|Calendário de Marketing 2026|Nicho|Fitness
2026-03-08|Dia Internacional da Mulher|commercial|Calendário de Marketing 2026|Máximo|
2026-03-09|Início da Semana do Consumidor|commercial|Calendário de Marketing 2026|Máximo|
2026-03-15|Dia do Consumidor|commercial|Calendário de Marketing 2026|Máximo|
2026-03-17|St. Patrick's Day|marketing|Calendário de Marketing 2026|Nicho|Bares/Cervejarias
2026-03-20|Início do outono|commercial|Calendário de Marketing 2026|Alto|Moda
2026-03-20|Dia Internacional da Felicidade|marketing|Calendário de Marketing 2026|Conteúdo|
2026-03-21|Dia Mundial da Síndrome de Down|marketing|Calendário de Marketing 2026|Causas|
2026-03-21|Dia Mundial da Poesia|marketing|Calendário de Marketing 2026|Conteúdo|
2026-03-22|Dia Mundial da Água|marketing|Calendário de Marketing 2026|Causas|ESG
2026-03-27|Dia do Circo|marketing|Calendário de Marketing 2026|Nicho|Kids
2026-03-31|Dia da Saúde e Nutrição|marketing|Calendário de Marketing 2026|Nicho|Saúde
2026-04-01|Dia da Mentira|marketing|Calendário de Marketing 2026|Conteúdo|
2026-04-02|Conscientização do Autismo|marketing|Calendário de Marketing 2026|Causas|
2026-04-05|Páscoa|commercial|Calendário de Marketing 2026|Máximo|
2026-04-07|Dia Mundial da Saúde|marketing|Calendário de Marketing 2026|Nicho|Saúde
2026-04-13|Dia do Beijo|marketing|Calendário de Marketing 2026|Conteúdo|
2026-04-19|Dia dos Povos Indígenas|marketing|Calendário de Marketing 2026|Causas|
2026-04-22|Descobrimento do Brasil|marketing|Calendário de Marketing 2026|Conteúdo|
2026-04-22|Dia da Terra|marketing|Calendário de Marketing 2026|Causas|ESG
2026-04-23|Dia Mundial do Livro|marketing|Calendário de Marketing 2026|Nicho|Editoras
2026-04-23|Dia de São Jorge|regional|Calendário de Marketing 2026|Regional|RJ
2026-04-28|Dia da Educação|marketing|Calendário de Marketing 2026|Nicho|Educação
2026-04-28|Dia do Frete Grátis|commercial|Calendário de Marketing 2026|Alto|E-commerce
2026-05-04|Star Wars Day|marketing|Calendário de Marketing 2026|Nicho|Geek
2026-05-10|Dia das Mães|commercial|Calendário de Marketing 2026|Máximo|
2026-05-12|Dia Internacional da Enfermagem|marketing|Calendário de Marketing 2026|Nicho|Saúde
2026-05-15|Dia Internacional da Família|marketing|Calendário de Marketing 2026|Causas|
2026-05-17|Combate à LGBTfobia|marketing|Calendário de Marketing 2026|Causas|
2026-05-17|Dia Mundial da Internet|marketing|Calendário de Marketing 2026|Conteúdo|
2026-05-01|Maio Laranja|campaign|Campanha mensal|Causas|
2026-05-25|Dia do Orgulho Nerd|marketing|Calendário de Marketing 2026|Nicho|Geek
2026-05-28|Dia Mundial do Hambúrguer|commercial|Calendário de Marketing 2026|Alto|Food
2026-06-05|Dia Mundial do Meio Ambiente|marketing|Calendário de Marketing 2026|Causas|ESG
2026-06-12|Dia dos Namorados|commercial|Calendário de Marketing 2026|Máximo|
2026-06-13|Dia de Santo Antônio|regional|Calendário de Marketing 2026|Regional|
2026-06-21|Início do inverno|commercial|Calendário de Marketing 2026|Alto|Moda
2026-06-21|Dia da Música|marketing|Calendário de Marketing 2026|Conteúdo|
2026-06-24|São João / Festas Juninas|commercial|Calendário de Marketing 2026|Muito alto|
2026-06-28|Dia do Orgulho LGBTQIA+|marketing|Calendário de Marketing 2026|Causas|
2026-06-29|Dia de São Pedro|regional|Calendário de Marketing 2026|Regional|
2026-06-29|Dia do Pescador|marketing|Calendário de Marketing 2026|Nicho|
2026-07-02|Independência da Bahia|regional|Calendário de Marketing 2026|Regional|BA
2026-07-09|Revolução Constitucionalista|regional|Calendário de Marketing 2026|Regional|SP
2026-07-10|Dia da Pizza|commercial|Calendário de Marketing 2026|Alto|Food
2026-07-13|Dia Mundial do Rock|marketing|Calendário de Marketing 2026|Conteúdo|
2026-07-15|Dia do Homem|commercial|Calendário de Marketing 2026|Alto|Varejo masculino
2026-07-20|Dia do Amigo e da Amizade|commercial|Calendário de Marketing 2026|Alto|
2026-07-25|Dia do Escritor|marketing|Calendário de Marketing 2026|Nicho|
2026-07-25|Dia do Motorista|marketing|Calendário de Marketing 2026|Nicho|
2026-07-25|Dia da Mulher Negra Latino-Americana e Caribenha|marketing|Calendário de Marketing 2026|Causas|
2026-07-26|Dia dos Avós|commercial|Calendário de Marketing 2026|Alto|
2026-07-01|Férias escolares|campaign|Campanha mensal|Muito alto|
2026-08-01|Agosto Dourado|campaign|Campanha mensal|Causas|Saúde
2026-08-01|Agosto Lilás|campaign|Campanha mensal|Causas|
2026-08-09|Dia dos Pais|commercial|Calendário de Marketing 2026|Máximo|
2026-08-11|Dia do Estudante|commercial|Calendário de Marketing 2026|Alto|Educação
2026-08-11|Dia do Advogado|marketing|Calendário de Marketing 2026|Nicho|Jurídico
2026-08-15|Dia dos Solteiros|commercial|Calendário de Marketing 2026|Alto|E-commerce
2026-08-19|Dia Mundial da Fotografia|marketing|Calendário de Marketing 2026|Nicho|Criativo
2026-08-22|Dia do Folclore|marketing|Calendário de Marketing 2026|Conteúdo|
2026-08-22|Dia do Supermercado|marketing|Calendário de Marketing 2026|Nicho|Varejo
2026-08-25|Dia do Soldado|marketing|Calendário de Marketing 2026|Nicho|
2026-08-31|Dia do Nutricionista|marketing|Calendário de Marketing 2026|Nicho|Saúde
2026-09-05|Dia da Amazônia|marketing|Calendário de Marketing 2026|Causas|ESG
2026-09-03|Início da Semana Brasil|commercial|Calendário de Marketing 2026|Muito alto|
2026-09-10|Setembro Amarelo|campaign|Campanha mensal|Causas|Saúde
2026-09-13|Fim da Semana Brasil|commercial|Calendário de Marketing 2026|Muito alto|
2026-09-15|Dia do Cliente|commercial|Calendário de Marketing 2026|Muito alto|
2026-09-21|Dia da Árvore|marketing|Calendário de Marketing 2026|Causas|ESG
2026-09-21|Dia de Luta da Pessoa com Deficiência|marketing|Calendário de Marketing 2026|Causas|
2026-09-22|Início da primavera|commercial|Calendário de Marketing 2026|Alto|Moda
2026-09-27|Dia Mundial do Turismo|commercial|Calendário de Marketing 2026|Alto|Turismo
2026-09-27|Dia de São Cosme e Damião|regional|Calendário de Marketing 2026|Regional|
2026-10-01|Dia da Pessoa Idosa|marketing|Calendário de Marketing 2026|Causas|
2026-10-01|Dia do Vendedor|marketing|Calendário de Marketing 2026|Nicho|Vendas
2026-10-01|Dia Internacional do Café|commercial|Calendário de Marketing 2026|Alto|Food
2026-10-01|Outubro Rosa|campaign|Campanha mensal|Causas|Saúde
2026-10-04|Dia Mundial dos Animais|commercial|Calendário de Marketing 2026|Alto|Pet
2026-10-04|São Francisco de Assis|marketing|Calendário de Marketing 2026|Nicho|Pet
2026-10-12|Dia das Crianças|commercial|Calendário de Marketing 2026|Máximo|Kids
2026-10-15|Dia do Professor|commercial|Calendário de Marketing 2026|Alto|Educação
2026-10-16|Dia Mundial da Alimentação|marketing|Calendário de Marketing 2026|Nicho|Food
2026-10-18|Dia do Médico|marketing|Calendário de Marketing 2026|Nicho|Saúde
2026-10-25|Dia do Dentista|marketing|Calendário de Marketing 2026|Nicho|Odontologia
2026-10-25|Dia Mundial do Macarrão|commercial|Calendário de Marketing 2026|Alto|Food
2026-10-29|Dia Nacional do Livro|marketing|Calendário de Marketing 2026|Nicho|Editoras
2026-10-31|Halloween|commercial|Calendário de Marketing 2026|Muito alto|
2026-11-01|Novembro Azul|campaign|Campanha mensal|Causas|Saúde
2026-11-11|Singles' Day — 11.11|commercial|Calendário de Marketing 2026|Alto|E-commerce
2026-11-23|Início da Black Week|commercial|Calendário de Marketing 2026|Muito alto|
2026-11-27|Black Friday|commercial|Calendário de Marketing 2026|Máximo|
2026-11-28|Black Weekend|commercial|Calendário de Marketing 2026|Muito alto|
2026-11-30|Cyber Monday|commercial|Calendário de Marketing 2026|Muito alto|
2026-12-01|Dezembro Vermelho|campaign|Campanha mensal|Causas|Saúde
2026-12-05|Dia do Voluntariado|marketing|Calendário de Marketing 2026|Causas|ESG
2026-12-08|Green Monday|commercial|Calendário de Marketing 2026|Alto|E-commerce
2026-12-08|Dia da Família|marketing|Calendário de Marketing 2026|Causas|
2026-12-15|Prazo médio de compra online para o Natal|commercial|Calendário de Marketing 2026|Muito alto|Logística
2026-12-24|Véspera de Natal|commercial|Calendário de Marketing 2026|Máximo|
2026-12-26|Trocas e liquidações pós-Natal|commercial|Calendário de Marketing 2026|Muito alto|
2026-12-31|Réveillon|commercial|Calendário de Marketing 2026|Muito alto|
2026-12-01|13º salário, ceia, moda festa e viagens|campaign|Campanha mensal|Máximo|
`.trim().split('\n')

const refs: CalendarReference[] = rows.map((line,index) => {
  const [date,title,category,sourceLabel,potential,segment] = line.split('|')
  const kind: CalendarReferenceKind =
    category === 'national_holiday' || category === 'optional_holiday' ? 'holiday' : 'opportunity'
  return { id:`ref-2026-${index+1}`,date,title,category:category as CalendarReferenceCategory,kind,sourceLabel,potential:potential||undefined,segment:segment||undefined }
})

export const CALENDAR_REFERENCE_CATEGORY_LABELS:Record<CalendarReferenceCategory,string> = {
  national_holiday:'Feriados nacionais',
  optional_holiday:'Pontos facultativos',
  commercial:'Datas comerciais',
  marketing:'Marketing e conteúdo',
  campaign:'Campanhas mensais',
  regional:'Datas regionais',
}

export function getCalendarReferences(year:number):CalendarReference[] {
  if (Number(year)!==2026) return []
  return [...refs].sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,'pt-BR'))
}