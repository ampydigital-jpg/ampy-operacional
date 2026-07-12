import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type WorkItemRow = {
  id: string
  title: string
  status: string | null
  client_id: string | null
  created_at: string | null
}

type ClientRow = {
  id: string
  name: string
}

type MessageRow = {
  id: string
  work_item_id: string | null
  is_resolved: boolean
  created_at: string
}

const statusLabel = (status: string | null) => {
  if (!status) return 'Sem status'

  const map: Record<string, string> = {
    todo: 'Pendente',
    pending: 'Pendente',
    in_progress: 'Em andamento',
    done: 'Concluída',
    completed: 'Concluída',
    blocked: 'Bloqueada',
  }

  return map[status] || status
}

export default async function DemandasComunicacaoPage() {
  const supabase = createAdminClient()

  const [workItemsResult, clientsResult, messagesResult] = await Promise.all([
    supabase
      .from('work_items')
      .select('id,title,status,client_id,created_at')
      .order('created_at', { ascending: false })
      .limit(100),

    supabase
      .from('clients')
      .select('id,name')
      .order('name', { ascending: true })
      .limit(200),

    supabase
      .from('internal_messages')
      .select('id,work_item_id,is_resolved,created_at')
      .not('work_item_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const workItems = (workItemsResult.data || []) as WorkItemRow[]
  const clients = (clientsResult.data || []) as ClientRow[]
  const messages = (messagesResult.data || []) as MessageRow[]

  const clientMap = new Map(clients.map((client) => [client.id, client]))

  const messageMap = new Map<string, { total: number; open: number; last?: string }>()

  for (const message of messages) {
    if (!message.work_item_id) continue

    const current = messageMap.get(message.work_item_id) || { total: 0, open: 0, last: undefined }
    current.total += 1

    if (!message.is_resolved) {
      current.open += 1
    }

    if (!current.last || new Date(message.created_at).getTime() > new Date(current.last).getTime()) {
      current.last = message.created_at
    }

    messageMap.set(message.work_item_id, current)
  }

  const withMessages = workItems.filter((item) => (messageMap.get(item.id)?.total || 0) > 0).length
  const openMessages = Array.from(messageMap.values()).reduce((sum, item) => sum + item.open, 0)

  return (
    <main className="ops-page demanda-comms-v17-page">
      <div className="demanda-comms-v17-head">
        <div>
          <span className="demanda-comms-v17-eyebrow">COMUNICAÇÃO POR DEMANDA</span>
          <h1>Comunicação das Demandas</h1>
          <p>Mensagens internas presas às demandas, com contexto, responsável, Drive e avisos direcionados.</p>
        </div>

        <Link href="/dashboard/chat" className="bsec demanda-comms-v17-toplink">
          Ver central geral
        </Link>
      </div>

      <section className="demanda-comms-v17-metrics">
        <div className="demanda-comms-v17-metric">
          <span>Demandas</span>
          <strong>{workItems.length}</strong>
          <small>na base operacional</small>
        </div>

        <div className="demanda-comms-v17-metric">
          <span>Com comunicação</span>
          <strong>{withMessages}</strong>
          <small>já possuem histórico</small>
        </div>

        <div className="demanda-comms-v17-metric">
          <span>Mensagens abertas</span>
          <strong>{openMessages}</strong>
          <small>pendentes de resolução</small>
        </div>
      </section>

      <section className="demanda-comms-v17-list">
        {workItems.length ? (
          workItems.map((item) => {
            const client = item.client_id ? clientMap.get(item.client_id) : null
            const stats = messageMap.get(item.id) || { total: 0, open: 0 }

            return (
              <article className="demanda-comms-v17-row" key={item.id}>
                <div>
                  <span className="demanda-comms-v17-status">{statusLabel(item.status)}</span>
                  <h2>{item.title}</h2>
                  <p>{client ? client.name : 'Sem cliente vinculado'}</p>
                </div>

                <div className="demanda-comms-v17-row-metrics">
                  <span>
                    <strong>{stats.total}</strong>
                    mensagens
                  </span>

                  <span>
                    <strong>{stats.open}</strong>
                    abertas
                  </span>
                </div>

                <Link href={'/dashboard/demandas/' + item.id + '/comunicacao'} className="bpri demanda-comms-v17-action">
                  Abrir comunicação
                </Link>
              </article>
            )
          })
        ) : (
          <div className="demanda-comms-v17-empty">
            <strong>Nenhuma demanda encontrada.</strong>
            <span>Quando houver demandas, elas aparecerão aqui para comunicação contextual.</span>
          </div>
        )}
      </section>
    </main>
  )
}
