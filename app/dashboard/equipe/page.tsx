import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type TeamMember = {
  id: string
  full_name: string
  email: string
  job_title: string
  access_type: string
  operational_area: string
  avatar_initials: string | null
  avatar_color: string | null
  avatar_bg: string | null
  is_active: boolean
  receives_internal_alerts: boolean
  display_order: number | null
}

const areaLabel = (area: string) => {
  const map: Record<string, string> = {
    gestao_operacional: 'Gestão Operacional',
    gestao_administrativa: 'Gestão Administrativa',
    captacao: 'Captação',
    edicao: 'Edição',
    operacoes: 'Operações',
    planejamento: 'Planejamento',
    design: 'Design',
    performance: 'Performance',
  }

  return map[area] || area
}

const accessLabel = (access: string) => {
  if (access === 'total') return 'Acesso Total'
  return 'Acesso Operacional'
}

export default async function EquipePage() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('team_members')
    .select('id,full_name,email,job_title,access_type,operational_area,avatar_initials,avatar_color,avatar_bg,is_active,receives_internal_alerts,display_order')
    .order('display_order', { ascending: true })

  const members = (data || []) as TeamMember[]

  const total = members.length
  const active = members.filter((member) => member.is_active).length
  const totalAccess = members.filter((member) => member.access_type === 'total').length
  const operationalAccess = members.filter((member) => member.access_type !== 'total').length
  const alertEnabled = members.filter((member) => member.receives_internal_alerts).length

  return (
    <main className="ops-page equipe-v17-page">
      <div className="equipe-v17-head">
        <div>
          <span className="equipe-v17-eyebrow">EQUIPE E ACESSOS</span>
          <h1>Equipe</h1>
          <p>Cadastro operacional da equipe Ampy, acessos iniciais e base para comunicação interna.</p>
        </div>

        <div className="equipe-v17-access-note">
          <strong>Regra atual</strong>
          <span>Acesso Total e Acesso Operacional liberam tudo nesta fase.</span>
        </div>
      </div>

      {error ? (
        <div className="equipe-v17-error">
          <strong>Erro ao carregar equipe.</strong>
          <span>{error.message}</span>
        </div>
      ) : null}

      <section className="equipe-v17-metrics">
        <div className="equipe-v17-metric">
          <span>Total</span>
          <strong>{total}</strong>
          <small>membros cadastrados</small>
        </div>

        <div className="equipe-v17-metric">
          <span>Ativos</span>
          <strong>{active}</strong>
          <small>aptos para operação</small>
        </div>

        <div className="equipe-v17-metric">
          <span>Acesso Total</span>
          <strong>{totalAccess}</strong>
          <small>gestão principal</small>
        </div>

        <div className="equipe-v17-metric">
          <span>Operacional</span>
          <strong>{operationalAccess}</strong>
          <small>execução da equipe</small>
        </div>

        <div className="equipe-v17-metric">
          <span>Avisos</span>
          <strong>{alertEnabled}</strong>
          <small>recebem alertas internos</small>
        </div>
      </section>

      <section className="equipe-v17-grid">
        {members.map((member) => (
          <article className="equipe-v17-card" key={member.id}>
            <div className="equipe-v17-card-top">
              <div
                className="equipe-v17-avatar"
                style={{
                  color: member.avatar_color || '#FFFFFF',
                  background: member.avatar_bg || '#3A3D43',
                }}
              >
                {member.avatar_initials || member.full_name.slice(0, 2).toUpperCase()}
              </div>

              <div>
                <h2>{member.job_title}</h2>
                <p>{member.email}</p>
              </div>
            </div>

            <div className="equipe-v17-card-info">
              <div>
                <span>Área</span>
                <strong>{areaLabel(member.operational_area)}</strong>
              </div>

              <div>
                <span>Acesso</span>
                <strong>{accessLabel(member.access_type)}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong>{member.is_active ? 'Ativo' : 'Inativo'}</strong>
              </div>

              <div>
                <span>Avisos internos</span>
                <strong>{member.receives_internal_alerts ? 'Sim' : 'Não'}</strong>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="equipe-v17-foundation">
        <div>
          <span className="equipe-v17-eyebrow">PRÓXIMA CAMADA</span>
          <h2>Comunicação interna contextual</h2>
          <p>
            A equipe já está pronta para receber avisos por pessoa, área e função. A próxima etapa liga mensagens internas a clientes, demandas, aprovações, agenda e links do Drive.
          </p>
        </div>

        <div className="equipe-v17-flow">
          <span>Mensagem</span>
          <span>Contexto</span>
          <span>Responsável</span>
          <span>Aviso</span>
        </div>
      </section>
    </main>
  )
}
