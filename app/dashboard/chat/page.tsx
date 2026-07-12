import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

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

type ClientRow = {
  id: string
  name: string
  status: string | null
}

type WorkItemRow = {
  id: string
  title: string
  status: string | null
  client_id: string | null
}

type FeedBoardRow = {
  id: string
  title: string
  status: string | null
  client_id: string | null
}

type AvisoRow = {
  id: string
  title: string
  status: string
  priority: string
}

type InternalMessage = {
  id: string
  body: string
  context_type: string
  client_id: string | null
  work_item_id: string | null
  feed_board_id: string | null
  aviso_id: string | null
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

const contextLabel = (type: string) => {
  const map: Record<string, string> = {
    general: 'Geral',
    client: 'Cliente',
    demand: 'Demanda',
    approval: 'Aprovação',
    alert: 'Aviso',
    drive: 'Drive',
  }

  return map[type] || type
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

async function createInternalMessageAction(formData: FormData) {
  'use server'

  const supabase = createAdminClient()

  const body = String(formData.get('body') || '').trim()
  const contextType = String(formData.get('context_type') || 'general').trim() || 'general'

  if (!body) {
    return
  }

  const clientId = emptyToNull(formData.get('client_id'))
  const workItemId = emptyToNull(formData.get('work_item_id'))
  const feedBoardId = emptyToNull(formData.get('feed_board_id'))
  const avisoId = emptyToNull(formData.get('aviso_id'))
  const driveUrl = emptyToNull(formData.get('drive_url'))
  const attachmentTitle = emptyToNull(formData.get('attachment_title'))
  const mentionedTeamMemberId = emptyToNull(formData.get('mentioned_team_member_id'))

  const contextId =
    contextType === 'client'
      ? clientId
      : contextType === 'demand'
        ? workItemId
        : contextType === 'approval'
          ? feedBoardId
          : contextType === 'alert'
            ? avisoId
            : null

  const currentAuthor = await getCurrentTeamAuthor(supabase)

  const createdByProfileId = currentAuthor.profileId
  const createdByTeamMemberId = currentAuthor.teamMemberId
  const createdByEmail = currentAuthor.email

  const { data: message, error } = await supabase
    .from('internal_messages')
    .insert({
      body,
      context_type: contextType,
      context_id: contextId,
      client_id: clientId,
      work_item_id: workItemId,
      feed_board_id: feedBoardId,
      aviso_id: avisoId,
      drive_url: driveUrl,
      attachment_title: attachmentTitle,
      created_by_profile_id: createdByProfileId,
      created_by_team_member_id: createdByTeamMemberId,
      created_by_email: createdByEmail,
      metadata: {
        origin: 'communication_center',
      },
    })
    .select('id')
    .single()

  if (error || !message) {
    console.error('Erro ao criar mensagem interna:', error)
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
        title: 'Nova mensagem interna',
        message: body.length > 180 ? body.slice(0, 180) + '...' : body,
        category: 'communication',
        priority: 'medium',
        status: 'active',
        source_module: 'communication',
        source_table: 'internal_messages',
        source_id: message.id,
        source_url: '/dashboard/chat',
        action_label: 'Abrir comunicação',
        related_entity_type: 'internal_message',
        related_entity_id: message.id,
        assigned_team_member_id: mentioned.data.id,
        assigned_email: mentioned.data.email,
        assigned_area: mentioned.data.operational_area,
        assigned_role: mentioned.data.job_title,
        notify_by_email: false,
        is_auto: true,
        dedupe_key: 'internal-message-mention-' + message.id + '-' + mentioned.data.id,
        metadata: {
          mentioned_email: mentioned.data.email,
          mentioned_role: mentioned.data.job_title,
          mentioned_area: mentioned.data.operational_area,
          drive_url: driveUrl,
        },
      })
    }
  }

  revalidatePath('/dashboard/chat')
  revalidatePath('/dashboard/avisos')
}

async function resolveInternalMessageAction(formData: FormData) {
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

  revalidatePath('/dashboard/chat')
}

export default async function ComunicacaoPage() {
  const supabase = createAdminClient()

  const [
    teamResult,
    clientsResult,
    workItemsResult,
    feedBoardsResult,
    avisosResult,
    messagesResult,
  ] = await Promise.all([
    supabase
      .from('team_members')
      .select('id,full_name,email,job_title,operational_area,avatar_initials,avatar_color,avatar_bg')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),

    supabase
      .from('clients')
      .select('id,name,status')
      .order('name', { ascending: true })
      .limit(80),

    supabase
      .from('work_items')
      .select('id,title,status,client_id')
      .order('created_at', { ascending: false })
      .limit(60),

    supabase
      .from('feed_boards')
      .select('id,title,status,client_id')
      .order('updated_at', { ascending: false })
      .limit(40),

    supabase
      .from('avisos')
      .select('id,title,status,priority')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .limit(40),

    supabase
      .from('internal_messages')
      .select('id,body,context_type,client_id,work_item_id,feed_board_id,aviso_id,drive_url,attachment_title,created_by_email,created_by_team_member_id,is_resolved,created_at')
      .order('created_at', { ascending: false })
      .limit(80),
  ])

  const members = (teamResult.data || []) as TeamMember[]
  const clients = (clientsResult.data || []) as ClientRow[]
  const workItems = (workItemsResult.data || []) as WorkItemRow[]
  const feedBoards = (feedBoardsResult.data || []) as FeedBoardRow[]
  const avisos = (avisosResult.data || []) as AvisoRow[]
  const messages = (messagesResult.data || []) as InternalMessage[]

  const clientMap = new Map(clients.map((client) => [client.id, client]))
  const workItemMap = new Map(workItems.map((item) => [item.id, item]))
  const feedBoardMap = new Map(feedBoards.map((board) => [board.id, board]))
  const avisoMap = new Map(avisos.map((aviso) => [aviso.id, aviso]))
  const memberMap = new Map(members.map((member) => [member.id, member]))

  const openMessages = messages.filter((message) => !message.is_resolved)
  const driveMessages = messages.filter((message) => Boolean(message.drive_url))
  const contextMessages = messages.filter((message) => message.context_type !== 'general')

  return (
    <main className="ops-page comunicacao-v17-page">
      <div className="comunicacao-v17-head">
        <div>
          <span className="comunicacao-v17-eyebrow">COMUNICAÇÃO INTERNA</span>
          <h1>Comunicação</h1>
          <p>Central de mensagens internas ligadas a clientes, demandas, aprovações, avisos e arquivos do Drive.</p>
        </div>

        <div className="comunicacao-v17-rule">
          <strong>Regra atual</strong>
          <span>A comunicação nasce dentro do sistema. E-mail fica preparado para avisos críticos no futuro.</span>
        </div>
      </div>

      <section className="comunicacao-v17-metrics">
        <div className="comunicacao-v17-metric">
          <span>Total</span>
          <strong>{messages.length}</strong>
          <small>mensagens registradas</small>
        </div>

        <div className="comunicacao-v17-metric">
          <span>Abertas</span>
          <strong>{openMessages.length}</strong>
          <small>pendentes de resolução</small>
        </div>

        <div className="comunicacao-v17-metric">
          <span>Contexto</span>
          <strong>{contextMessages.length}</strong>
          <small>ligadas à operação</small>
        </div>

        <div className="comunicacao-v17-metric">
          <span>Drive</span>
          <strong>{driveMessages.length}</strong>
          <small>com link anexado</small>
        </div>

        <div className="comunicacao-v17-metric">
          <span>Equipe</span>
          <strong>{members.length}</strong>
          <small>pessoas disponíveis</small>
        </div>
      </section>

      <section className="comunicacao-v17-layout">
        <form action={createInternalMessageAction} className="comunicacao-v17-compose">
          <div>
            <span className="comunicacao-v17-eyebrow">NOVA MENSAGEM</span>
            <h2>Registrar comunicação</h2>
            <p>Use para alinhar algo internamente e manter o contexto operacional registrado.</p>
          </div>

          <label>
            <span>Mensagem</span>
            <textarea name="body" placeholder="Ex.: Cliente pediu ajuste na legenda do post 03. Design precisa revisar antes da programação." required />
          </label>

          <div className="comunicacao-v17-form-grid">
            <label>
              <span>Tipo de contexto</span>
              <select name="context_type" defaultValue="general">
                <option value="general">Geral</option>
                <option value="client">Cliente</option>
                <option value="demand">Demanda</option>
                <option value="approval">Aprovação</option>
                <option value="alert">Aviso</option>
                <option value="drive">Drive</option>
              </select>
            </label>

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
          </div>

          <div className="comunicacao-v17-form-grid">
            <label>
              <span>Cliente</span>
              <select name="client_id" defaultValue="">
                <option value="">Nenhum cliente</option>
                {clients.map((client) => (
                  <option value={client.id} key={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Demanda</span>
              <select name="work_item_id" defaultValue="">
                <option value="">Nenhuma demanda</option>
                {workItems.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="comunicacao-v17-form-grid">
            <label>
              <span>Aprovação</span>
              <select name="feed_board_id" defaultValue="">
                <option value="">Nenhuma aprovação</option>
                {feedBoards.map((board) => (
                  <option value={board.id} key={board.id}>
                    {board.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Aviso</span>
              <select name="aviso_id" defaultValue="">
                <option value="">Nenhum aviso</option>
                {avisos.map((aviso) => (
                  <option value={aviso.id} key={aviso.id}>
                    {aviso.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="comunicacao-v17-form-grid">
            <label>
              <span>Título do arquivo/link</span>
              <input name="attachment_title" placeholder="Ex.: Pasta Drive da aprovação" />
            </label>

            <label>
              <span>Link do Drive</span>
              <input name="drive_url" placeholder="https://drive.google.com/..." />
            </label>
          </div>

          <button type="submit" className="bpri comunicacao-v17-submit">
            Registrar mensagem
          </button>
        </form>

        <aside className="comunicacao-v17-side">
          <div className="comunicacao-v17-panel">
            <span className="comunicacao-v17-eyebrow">EQUIPE</span>
            <h3>Menções disponíveis</h3>

            <div className="comunicacao-v17-member-list">
              {members.map((member) => (
                <div className="comunicacao-v17-member" key={member.id}>
                  <div
                    className="comunicacao-v17-avatar"
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

          <div className="comunicacao-v17-panel">
            <span className="comunicacao-v17-eyebrow">FLUXO</span>
            <h3>Como usar</h3>
            <p>Registre a mensagem, escolha o contexto, mencione uma pessoa quando precisar de ação e anexe o link do Drive se houver arquivo envolvido.</p>
          </div>
        </aside>
      </section>

      <section className="comunicacao-v17-feed">
        <div className="comunicacao-v17-feed-head">
          <div>
            <span className="comunicacao-v17-eyebrow">HISTÓRICO</span>
            <h2>Mensagens internas</h2>
          </div>

          <span>{openMessages.length} aberta(s)</span>
        </div>

        <div className="comunicacao-v17-message-list">
          {messages.length ? (
            messages.map((message) => {
              const author = message.created_by_team_member_id ? memberMap.get(message.created_by_team_member_id) : null
              const client = message.client_id ? clientMap.get(message.client_id) : null
              const workItem = message.work_item_id ? workItemMap.get(message.work_item_id) : null
              const feedBoard = message.feed_board_id ? feedBoardMap.get(message.feed_board_id) : null
              const aviso = message.aviso_id ? avisoMap.get(message.aviso_id) : null

              return (
                <article className={message.is_resolved ? 'comunicacao-v17-message resolved' : 'comunicacao-v17-message'} key={message.id}>
                  <div className="comunicacao-v17-message-main">
                    <div className="comunicacao-v17-message-top">
                      <span>{contextLabel(message.context_type)}</span>
                      <small>{formatDateTime(message.created_at)}</small>
                    </div>

                    <p>{message.body}</p>

                    <div className="comunicacao-v17-context-tags">
                      {author ? <span>Autor: {author.job_title}</span> : <span>Autor: {message.created_by_email || 'Ampy'}</span>}
                      {client ? <span>Cliente: {client.name}</span> : null}
                      {workItem ? <span>Demanda: {workItem.title}</span> : null}
                      {feedBoard ? <span>Aprovação: {feedBoard.title}</span> : null}
                      {aviso ? <span>Aviso: {aviso.title}</span> : null}
                      {message.drive_url ? (
                        <a href={message.drive_url} target="_blank" rel="noreferrer">
                          {message.attachment_title || 'Abrir Drive'}
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="comunicacao-v17-message-actions">
                    <span>{message.is_resolved ? 'Resolvida' : 'Aberta'}</span>

                    {!message.is_resolved ? (
                      <form action={resolveInternalMessageAction}>
                        <input type="hidden" name="message_id" value={message.id} />
                        <button type="submit" className="bsec">
                          Resolver
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              )
            })
          ) : (
            <div className="comunicacao-v17-empty">
              <strong>Nenhuma mensagem interna registrada.</strong>
              <span>Crie a primeira comunicação vinculada a cliente, demanda, aprovação, aviso ou Drive.</span>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
