import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: {
    workItemId: string
  }
}

type TeamMember = {
  id: string
  full_name: string
  email: string
  job_title: string
  operational_area: string
  avatar_initials: string | null
  avatar_color: string | null
  avatar_bg: string | null
}

type InternalMessage = {
  id: string
  body: string
  drive_url: string | null
  attachment_title: string | null
  created_by_email: string | null
  created_by_team_member_id: string | null
  is_resolved: boolean
  created_at: string
}

const emptyToNull = (value: FormDataEntryValue | null) => {
  if (!value) return null
  const text = String(value).trim()
  return text.length ? text : null
}

const formatDateTime = (value: string) => {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
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

async function getCurrentTeamAuthor(adminSupabase: ReturnType<typeof createAdminClient>) {
  const authSupabase = createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  let teamMember: { id: string; email: string; profile_id: string | null } | null = null

  if (user?.id) {
    const { data } = await adminSupabase
      .from('team_members')
      .select('id,email,profile_id')
      .eq('profile_id', user.id)
      .maybeSingle()

    teamMember = data
  }

  if (!teamMember && user?.email) {
    const { data } = await adminSupabase
      .from('team_members')
      .select('id,email,profile_id')
      .eq('email', user.email)
      .maybeSingle()

    teamMember = data
  }

  return {
    profileId: user?.id || teamMember?.profile_id || null,
    teamMemberId: teamMember?.id || null,
    email: teamMember?.email || user?.email || 'ampydigital@gmail.com',
  }
}

async function createDemandMessageAction(workItemId: string, formData: FormData) {
  'use server'

  const supabase = createAdminClient()

  const body = String(formData.get('body') || '').trim()
  const driveUrl = emptyToNull(formData.get('drive_url'))
  const attachmentTitle = emptyToNull(formData.get('attachment_title'))
  const mentionedTeamMemberId = emptyToNull(formData.get('mentioned_team_member_id'))

  if (!body) return

  const workItemResult = await supabase
    .from('work_items')
    .select('id,title,client_id')
    .eq('id', workItemId)
    .maybeSingle()

  if (!workItemResult.data) return

  const currentAuthor = await getCurrentTeamAuthor(supabase)

  const createdByProfileId = currentAuthor.profileId
  const createdByTeamMemberId = currentAuthor.teamMemberId
  const createdByEmail = currentAuthor.email

  const { data: message, error } = await supabase
    .from('internal_messages')
    .insert({
      body,
      context_type: 'demand',
      context_id: workItemId,
      client_id: workItemResult.data.client_id || null,
      work_item_id: workItemId,
      drive_url: driveUrl,
      attachment_title: attachmentTitle,
      created_by_profile_id: createdByProfileId,
      created_by_team_member_id: createdByTeamMemberId,
      created_by_email: createdByEmail,
      metadata: {
        origin: 'work_item_context',
        work_item_title: workItemResult.data.title,
      },
    })
    .select('id')
    .single()

  if (error || !message) {
    console.error('Erro ao criar comunicação da demanda:', error)
    return
  }

  if (mentionedTeamMemberId) {
    const mentioned = await supabase
      .from('team_members')
      .select('id,email,job_title,operational_area')
      .eq('id', mentionedTeamMemberId)
      .maybeSingle()

    if (mentioned.data) {
      await supabase.from('internal_message_mentions').insert({
        message_id: message.id,
        mentioned_team_member_id: mentioned.data.id,
        mentioned_email: mentioned.data.email,
        mentioned_area: mentioned.data.operational_area,
        mentioned_role: mentioned.data.job_title,
      })

      await supabase.from('avisos').insert({
        title: 'Nova comunicação em demanda',
        message: body.length > 180 ? body.slice(0, 180) + '...' : body,
        category: 'communication',
        priority: 'medium',
        status: 'active',
        source_module: 'work_item_communication',
        source_table: 'internal_messages',
        source_id: message.id,
        source_url: '/dashboard/demandas/' + workItemId + '/comunicacao',
        action_label: 'Abrir demanda',
        related_entity_type: 'work_item',
        related_entity_id: workItemId,
        client_id: workItemResult.data.client_id || null,
        work_item_id: workItemId,
        assigned_team_member_id: mentioned.data.id,
        assigned_email: mentioned.data.email,
        assigned_area: mentioned.data.operational_area,
        assigned_role: mentioned.data.job_title,
        notify_by_email: false,
        is_auto: true,
        dedupe_key: 'work-item-message-mention-' + message.id + '-' + mentioned.data.id,
        metadata: {
          mentioned_email: mentioned.data.email,
          mentioned_role: mentioned.data.job_title,
          mentioned_area: mentioned.data.operational_area,
          drive_url: driveUrl,
          work_item_title: workItemResult.data.title,
        },
      })
    }
  }

  revalidatePath('/dashboard/demandas/' + workItemId + '/comunicacao')
  revalidatePath('/dashboard/demandas/comunicacao')
  revalidatePath('/dashboard/chat')
  revalidatePath('/dashboard/avisos')
}

async function resolveDemandMessageAction(workItemId: string, formData: FormData) {
  'use server'

  const supabase = createAdminClient()
  const messageId = emptyToNull(formData.get('message_id'))

  if (!messageId) return

  await supabase
    .from('internal_messages')
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('work_item_id', workItemId)

  revalidatePath('/dashboard/demandas/' + workItemId + '/comunicacao')
  revalidatePath('/dashboard/demandas/comunicacao')
  revalidatePath('/dashboard/chat')
}

export default async function DemandaComunicacaoPage({ params }: PageProps) {
  const workItemId = params.workItemId
  const supabase = createAdminClient()

  const [workItemResult, teamResult, messagesResult] = await Promise.all([
    supabase
      .from('work_items')
      .select('id,title,status,client_id')
      .eq('id', workItemId)
      .maybeSingle(),

    supabase
      .from('team_members')
      .select('id,full_name,email,job_title,operational_area,avatar_initials,avatar_color,avatar_bg')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),

    supabase
      .from('internal_messages')
      .select('id,body,drive_url,attachment_title,created_by_email,created_by_team_member_id,is_resolved,created_at')
      .eq('work_item_id', workItemId)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (!workItemResult.data) {
    notFound()
  }

  const workItem = workItemResult.data
  const members = (teamResult.data || []) as TeamMember[]
  const messages = (messagesResult.data || []) as InternalMessage[]
  const memberMap = new Map(members.map((member) => [member.id, member]))

  const clientResult = workItem.client_id
    ? await supabase.from('clients').select('id,name').eq('id', workItem.client_id).maybeSingle()
    : null

  const openMessages = messages.filter((message) => !message.is_resolved)
  const driveMessages = messages.filter((message) => Boolean(message.drive_url))

  const createAction = createDemandMessageAction.bind(null, workItemId)
  const resolveAction = resolveDemandMessageAction.bind(null, workItemId)

  return (
    <main className="ops-page demanda-comms-v17-page">
      <div className="demanda-comms-v17-head">
        <div>
          <span className="demanda-comms-v17-eyebrow">COMUNICAÇÃO DA DEMANDA</span>
          <h1>{workItem.title}</h1>
          <p>{clientResult?.data?.name || 'Sem cliente vinculado'} · Conversa interna presa à demanda.</p>
        </div>

        <div className="demanda-comms-v17-actions">
          <Link href="/dashboard/demandas/comunicacao" className="bsec">
            Voltar
          </Link>
          <Link href="/dashboard/chat" className="bsec">
            Central
          </Link>
        </div>
      </div>

      <section className="demanda-comms-v17-metrics">
        <div className="demanda-comms-v17-metric">
          <span>Mensagens</span>
          <strong>{messages.length}</strong>
          <small>histórico da demanda</small>
        </div>

        <div className="demanda-comms-v17-metric">
          <span>Abertas</span>
          <strong>{openMessages.length}</strong>
          <small>pendentes de resolução</small>
        </div>

        <div className="demanda-comms-v17-metric">
          <span>Drive</span>
          <strong>{driveMessages.length}</strong>
          <small>links anexados</small>
        </div>
      </section>

      <section className="demanda-comms-v17-layout">
        <form action={createAction} className="demanda-comms-v17-compose">
          <div>
            <span className="demanda-comms-v17-eyebrow">NOVA COMUNICAÇÃO</span>
            <h2>Registrar comentário interno</h2>
            <p>Use este bloco para direcionar ajustes, dúvidas e alinhamentos sem perder o contexto da demanda.</p>
          </div>

          <label>
            <span>Mensagem</span>
            <textarea name="body" placeholder="Ex.: @Design ajustar capa conforme briefing. Link do Drive abaixo." required />
          </label>

          <div className="demanda-comms-v17-form-grid">
            <label>
              <span>Mencionar equipe</span>
              <select name="mentioned_team_member_id" defaultValue="">
                <option value="">Sem menção</option>
                {members.map((member) => (
                  <option value={member.id} key={member.id}>
                    {member.job_title} — {member.email}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Título do link</span>
              <input name="attachment_title" placeholder="Ex.: Pasta Drive da demanda" />
            </label>
          </div>

          <label>
            <span>Link do Drive</span>
            <input name="drive_url" placeholder="https://drive.google.com/..." />
          </label>

          <button type="submit" className="bpri demanda-comms-v17-submit">
            Registrar na demanda
          </button>
        </form>

        <aside className="demanda-comms-v17-side">
          <div className="demanda-comms-v17-panel">
            <span className="demanda-comms-v17-eyebrow">EQUIPE</span>
            <h3>Quem pode ser acionado</h3>

            <div className="demanda-comms-v17-members">
              {members.map((member) => (
                <div className="demanda-comms-v17-member" key={member.id}>
                  <div
                    className="demanda-comms-v17-avatar"
                    style={{
                      color: member.avatar_color || '#FFFFFF',
                      background: member.avatar_bg || '#3A3D43',
                    }}
                  >
                    {member.avatar_initials || member.job_title.slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <strong>{member.job_title}</strong>
                    <span>{areaLabel(member.operational_area)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="demanda-comms-v17-panel">
            <span className="demanda-comms-v17-eyebrow">REGRA</span>
            <h3>Contexto primeiro</h3>
            <p>Esta conversa pertence a esta demanda. A Central de Comunicação apenas reúne o histórico.</p>
          </div>
        </aside>
      </section>

      <section className="demanda-comms-v17-feed">
        <div className="demanda-comms-v17-feed-head">
          <div>
            <span className="demanda-comms-v17-eyebrow">HISTÓRICO</span>
            <h2>Comunicação interna da demanda</h2>
          </div>

          <span>{openMessages.length} aberta(s)</span>
        </div>

        <div className="demanda-comms-v17-message-list">
          {messages.length ? (
            messages.map((message) => {
              const author = message.created_by_team_member_id ? memberMap.get(message.created_by_team_member_id) : null

              return (
                <article className={message.is_resolved ? 'demanda-comms-v17-message resolved' : 'demanda-comms-v17-message'} key={message.id}>
                  <div className="demanda-comms-v17-message-main">
                    <div className="demanda-comms-v17-message-top">
                      <span>{message.is_resolved ? 'Resolvida' : 'Aberta'}</span>
                      <small>{formatDateTime(message.created_at)}</small>
                    </div>

                    <p>{message.body}</p>

                    <div className="demanda-comms-v17-tags">
                      <span>Autor: {author ? author.job_title : message.created_by_email || 'Ampy'}</span>
                      {message.drive_url ? (
                        <a href={message.drive_url} target="_blank" rel="noreferrer">
                          {message.attachment_title || 'Abrir Drive'}
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {!message.is_resolved ? (
                    <form action={resolveAction} className="demanda-comms-v17-message-action">
                      <input type="hidden" name="message_id" value={message.id} />
                      <button type="submit" className="bsec">
                        Resolver
                      </button>
                    </form>
                  ) : null}
                </article>
              )
            })
          ) : (
            <div className="demanda-comms-v17-empty">
              <strong>Nenhuma comunicação nesta demanda.</strong>
              <span>Registre o primeiro comentário interno para manter o histórico operacional.</span>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
