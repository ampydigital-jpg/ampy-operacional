
'use client'

// AMPY-V17-A21.1 — CORREÇÃO INTEGRAL DO PAINEL DE CLIENTES

// AMPY-V17-A21 — PAINEL DE CLIENTES, LOGO E MAPA ESTRATÉGICO

import {
  useMemo,
  useState,
} from 'react'

import {
  createClient as createBrowserClient,
} from '@/lib/supabase/client'

import {
  archiveClientAction,
  createClientAction,
  createClientServiceAction,
  updateClientAction,
} from '@/lib/actions'

import ClientServiceCycleSettings from './ClientServiceCycleSettings'

const SEGMENTS = [
  'Moda',
  'Varejo',
  'Gastronomia',
  'Saúde',
  'Odontologia',
  'Estética',
  'Advocacia',
  'Construção',
  'Imobiliário',
  'Condomínio',
  'Marketing',
  'Serviços',
  'ONG',
  'Outro',
]

const TABS = [
  'Visão geral',
  'Mapa de calor',
  'Serviços',
  'Demandas',
  'Documentos e Agenda',
  'Histórico',
]

const OPERATION_MODELS = [
  [
    'monthly',
    'Mensal',
  ],
  [
    'parallel',
    'Paralelo',
  ],
  [
    'not_applicable',
    'Não aplicável',
  ],
] as const

const ALLOWED_LOGO_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
]

function text(
  input: any,
  fallback = '—',
) {
  const output =
    String(
      input || '',
    ).trim()

  return output || fallback
}

function formatDate(
  input?: string | null,
) {
  if (!input) {
    return '—'
  }

  const date =
    new Date(
      String(input)
        .slice(0, 10) +
        'T12:00:00',
    )

  return Number.isNaN(
    date.getTime(),
  )
    ? '—'
    : date.toLocaleDateString(
        'pt-BR',
      )
}

function initials(
  name?: string | null,
) {
  return (
    String(name || 'CL')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0],
      )
      .join('')
      .toUpperCase() ||
    'CL'
  )
}

function statusLabel(
  status?: string | null,
) {
  const value =
    String(
      status || 'active',
    )

  if (value === 'active') {
    return 'Ativo'
  }

  if (
    value === 'archived'
  ) {
    return 'Arquivado'
  }

  if (
    value === 'paused'
  ) {
    return 'Pausado'
  }

  if (
    value === 'onboarding'
  ) {
    return 'Onboarding'
  }

  return 'Inativo'
}

function statusClass(
  status?: string | null,
) {
  const value =
    String(
      status || 'active',
    )

  if (value === 'active') {
    return 'bok'
  }

  if (
    value === 'paused' ||
    value === 'onboarding'
  ) {
    return 'bwarn'
  }

  if (
    value === 'archived'
  ) {
    return 'bmut'
  }

  return 'bcrit'
}

function operationModelLabel(
  input?: string | null,
) {
  const value =
    String(
      input || 'monthly',
    )

  return (
    OPERATION_MODELS.find(
      ([id]) =>
        id === value,
    )?.[1] ||
    'Mensal'
  )
}

function operationModelClass(
  input?: string | null,
) {
  const value =
    String(
      input || 'monthly',
    )

  if (
    value === 'parallel'
  ) {
    return 'parallel'
  }

  if (
    value ===
    'not_applicable'
  ) {
    return 'not-applicable'
  }

  return 'monthly'
}

function dateFilterLabel(
  value: string,
) {
  if (value === 'expired') {
    return 'Contratos vencidos'
  }

  if (value === 'next30') {
    return 'Término em 30 dias'
  }

  if (value === 'next90') {
    return 'Término em 90 dias'
  }

  if (value === 'no_end') {
    return 'Sem término'
  }

  return 'Todos os términos'
}

function statusScopeLabel(
  value: string,
) {
  if (value === 'active') {
    return 'Somente ativos'
  }

  if (
    value === 'inactive'
  ) {
    return 'Inativos'
  }

  if (
    value === 'archived'
  ) {
    return 'Arquivados'
  }

  return 'Todos'
}

function safeFileName(
  input: string,
) {
  return String(
    input || 'logo',
  )
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .replace(
      /[^a-zA-Z0-9._-]+/g,
      '-',
    )
    .replace(
      /-+/g,
      '-',
    )
    .replace(
      /^-|-$|^\./g,
      '',
    )
    .toLowerCase() ||
    'logo'
}

function isClosedStatus(
  status?: string | null,
) {
  return [
    'done',
    'delivered',
    'cancelled',
    'archived',
  ].includes(
    String(status || ''),
  )
}

function heatmap(
  client: any,
  demands: any[],
) {
  const clientDemands =
    demands.filter(
      (demand) =>
        demand.client_id ===
        client?.id,
    )

  const total =
    clientDemands.length

  const delivered =
    clientDemands.filter(
      (demand) =>
        [
          'done',
          'delivered',
          'approved',
        ].includes(
          String(
            demand.status,
          ),
        ),
    ).length

  const late =
    clientDemands.filter(
      (demand) => {
        const deadline =
          demand.final_deadline ||
          demand.internal_deadline

        return (
          deadline &&
          deadline <
            new Date()
              .toISOString()
              .slice(0, 10) &&
          !isClosedStatus(
            demand.status,
          )
        )
      },
    ).length

  const active =
    clientDemands.filter(
      (demand) =>
        !isClosedStatus(
          demand.status,
        ),
    ).length

  const deliveryRate =
    total
      ? Math.round(
          (
            delivered /
            total
          ) * 100,
        )
      : 60

  const risk =
    Math.min(
      95,
      Math.max(
        5,
        20 +
          late * 18 +
          active * 3 -
          delivered * 4,
      ),
    )

  const morale =
    Math.min(
      95,
      Math.max(
        5,
        deliveryRate -
          late * 12 +
          (
            String(
              client?.status ||
              'active',
            ) === 'active'
              ? 15
              : -15
          ),
      ),
    )

  return {
    total,
    delivered,
    late,
    active,
    deliveryRate,
    risk,
    morale,
  }
}

function ClientLogo({
  client,
  size = 'small',
}: {
  client: any
  size?: 'small' | 'large'
}) {
  const [
    failed,
    setFailed,
  ] = useState(false)

  const logoUrl =
    String(
      client?.logo_url || '',
    ).trim()

  return (
    <span
      className={
        'client-logo client-logo-' +
        size
      }
    >
      {logoUrl && !failed ? (
        <img
          src={logoUrl}
          alt={
            'Logo ' +
            text(
              client?.name,
              'Cliente',
            )
          }
          onError={() =>
            setFailed(true)
          }
        />
      ) : (
        <b>
          {client
            ?.avatar_initials ||
            initials(
              client?.name,
            )}
        </b>
      )}
    </span>
  )
}

export default function ClientsView({
  clients = [],
  profiles = [],
  services = [],
  clientServices = [],
  demands = [],
  loadErrors = [],
}: any) {
  const safeClients =
    Array.isArray(clients)
      ? clients.filter(Boolean)
      : []

  const safeProfiles =
    Array.isArray(profiles)
      ? profiles.filter(Boolean)
      : []

  const safeServices =
    Array.isArray(services)
      ? services.filter(Boolean)
      : []

  const safeClientServices =
    Array.isArray(
      clientServices,
    )
      ? clientServices.filter(
          Boolean,
        )
      : []

  const safeDemands =
    Array.isArray(demands)
      ? demands.filter(Boolean)
      : []

  const safeLoadErrors =
    Array.isArray(loadErrors)
      ? loadErrors.filter(Boolean)
      : []

  const [
    query,
    setQuery,
  ] = useState('')

  const [
    statusScope,
    setStatusScope,
  ] = useState('active')

  const [
    modelScope,
    setModelScope,
  ] = useState('all')

  const [
    dateScope,
    setDateScope,
  ] = useState('all')

  const [
    selectedId,
    setSelectedId,
  ] = useState(
    safeClients.find(
      (client: any) =>
        String(
          client.status ||
          'active',
        ) === 'active',
    )?.id ||
      safeClients[0]?.id ||
      null,
  )

  const [
    tab,
    setTab,
  ] = useState(
    'Visão geral',
  )

  const [
    newModal,
    setNewModal,
  ] = useState(false)

  const [
    edit,
    setEdit,
  ] = useState(false)

  const [
    serviceModal,
    setServiceModal,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    logoFile,
    setLogoFile,
  ] = useState<File | null>(
    null,
  )

  const [
    logoPreview,
    setLogoPreview,
  ] = useState<
    string | null
  >(null)

  const [
    removeLogo,
    setRemoveLogo,
  ] = useState(false)

  const filteredClients =
    useMemo(() => {
      const term =
        query
          .toLowerCase()
          .trim()

      const today =
        new Date()

      today.setHours(
        0,
        0,
        0,
        0,
      )

      const plus30 =
        new Date(
          today.getTime() +
            30 * 86400000,
        )

      const plus90 =
        new Date(
          today.getTime() +
            90 * 86400000,
        )

      return safeClients.filter(
        (client: any) => {
          const status =
            String(
              client.status ||
              'active',
            )

          const model =
            String(
              client.operation_model ||
              'monthly',
            )

          const endRaw =
            client.fim_contrato ||
            client.ended_at

          const end =
            endRaw
              ? new Date(
                  String(
                    endRaw,
                  ).slice(
                    0,
                    10,
                  ) +
                    'T12:00:00',
                )
              : null

          const matchesStatus =
            statusScope ===
              'all' ||
            (
              statusScope ===
                'active' &&
              status === 'active'
            ) ||
            (
              statusScope ===
                'archived' &&
              status ===
                'archived'
            ) ||
            (
              statusScope ===
                'inactive' &&
              [
                'inactive',
                'ended',
                'cancelled',
                'paused',
              ].includes(status)
            )

          const matchesModel =
            modelScope ===
              'all' ||
            model ===
              modelScope

          const matchesDate =
            dateScope ===
              'all' ||
            (
              dateScope ===
                'no_end' &&
              !endRaw
            ) ||
            (
              dateScope ===
                'expired' &&
              end &&
              end < today
            ) ||
            (
              dateScope ===
                'next30' &&
              end &&
              end >= today &&
              end <= plus30
            ) ||
            (
              dateScope ===
                'next90' &&
              end &&
              end >= today &&
              end <= plus90
            )

          const matchesSearch =
            !term ||
            [
              client.name,
              client.segment,
              client.cidade,
              client.main_contact_phone,
              client.main_contact_name,
              client.main_contact_email,
            ].some(
              (value) =>
                String(
                  value || '',
                )
                  .toLowerCase()
                  .includes(term),
            )

          return (
            matchesStatus &&
            matchesModel &&
            matchesDate &&
            matchesSearch
          )
        },
      )
    }, [
      safeClients,
      query,
      statusScope,
      modelScope,
      dateScope,
    ])

  const selected =
    useMemo(
      () =>
        filteredClients.find(
          (client: any) =>
            client.id ===
            selectedId,
        ) ||
        filteredClients[0] ||
        null,
      [
        filteredClients,
        selectedId,
      ],
    )

  const selectedServices =
    selected
      ? safeClientServices.filter(
          (service: any) =>
            service.client_id ===
            selected.id,
        )
      : []

  const selectedDemands =
    selected
      ? safeDemands.filter(
          (demand: any) =>
            demand.client_id ===
            selected.id,
        )
      : []

  const activeCount =
    safeClients.filter(
      (client: any) =>
        String(
          client.status ||
          'active',
        ) === 'active',
    ).length

  const inactiveCount =
    safeClients.filter(
      (client: any) =>
        [
          'inactive',
          'ended',
          'cancelled',
          'paused',
        ].includes(
          String(
            client.status ||
            '',
          ),
        ),
    ).length

  const archivedCount =
    safeClients.filter(
      (client: any) =>
        String(
          client.status ||
          '',
        ) === 'archived',
    ).length

  const parallelCount =
    safeClients.filter(
      (client: any) =>
        String(
          client.operation_model ||
          'monthly',
        ) === 'parallel',
    ).length

  const heat =
    selected
      ? heatmap(
          selected,
          safeDemands,
        )
      : null

  function resetLogoState(
    client?: any,
  ) {
    setLogoFile(null)

    setLogoPreview(
      client?.logo_url ||
        null,
    )

    setRemoveLogo(false)
  }

  function startNewClient() {
    setError('')
    setLoading(false)
    resetLogoState()
    setNewModal(true)
  }

  function startEditClient() {
    if (!selected) {
      return
    }

    setError('')
    setLoading(false)
    resetLogoState(selected)
    setEdit(true)
  }

  function selectClient(
    client: any,
  ) {
    setSelectedId(
      client.id,
    )

    setTab(
      'Visão geral',
    )

    setEdit(false)
    setError('')
    resetLogoState(client)
  }

  function handleLogoFile(
    file: File | null,
  ) {
    setError('')

    if (!file) {
      setLogoFile(null)
      return
    }

    if (
      !ALLOWED_LOGO_TYPES.includes(
        file.type,
      )
    ) {
      setError(
        'Use uma imagem PNG, JPG ou WEBP.',
      )

      return
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setError(
        'A logo deve ter no máximo 5 MB.',
      )

      return
    }

    setLogoFile(file)
    setRemoveLogo(false)

    setLogoPreview(
      URL.createObjectURL(
        file,
      ),
    )
  }

  function requestLogoRemoval() {
    setLogoFile(null)
    setLogoPreview(null)
    setRemoveLogo(true)
    setError('')
  }

  async function submitClient(
    event:
      React.FormEvent<
        HTMLFormElement
      >,
    update = false,
  ) {
    event.preventDefault()

    const form =
      event.currentTarget

    setLoading(true)
    setError('')

    const formData =
      new FormData(form)

    if (
      update &&
      selected
    ) {
      formData.set(
        'id',
        selected.id,
      )
    }

    const supabase =
      createBrowserClient()

    let uploadedPath:
      | string
      | null = null

    const oldStoragePath =
      update
        ? selected
            ?.logo_storage_path ||
          null
        : null

    try {
      if (logoFile) {
        const folder =
          update &&
          selected?.id
            ? selected.id
            : 'new-' +
              crypto.randomUUID()

        uploadedPath =
          folder +
          '/' +
          Date.now() +
          '-' +
          safeFileName(
            logoFile.name,
          )

        const {
          error:
            uploadError,
        } =
          await supabase
            .storage
            .from(
              'client-logos',
            )
            .upload(
              uploadedPath,
              logoFile,
              {
                cacheControl:
                  '3600',
                upsert: false,
              },
            )

        if (uploadError) {
          throw uploadError
        }

        const {
          data:
            publicUrlData,
        } =
          supabase
            .storage
            .from(
              'client-logos',
            )
            .getPublicUrl(
              uploadedPath,
            )

        if (
          !publicUrlData
            .publicUrl
        ) {
          throw new Error(
            'Não foi possível gerar a URL da logo.',
          )
        }

        formData.set(
          'logo_url',
          publicUrlData
            .publicUrl,
        )

        formData.set(
          'logo_storage_path',
          uploadedPath,
        )
      } else if (
        removeLogo
      ) {
        formData.set(
          'logo_url',
          '',
        )

        formData.set(
          'logo_storage_path',
          '',
        )
      } else {
        formData.set(
          'logo_url',
          selected?.logo_url ||
            '',
        )

        formData.set(
          'logo_storage_path',
          selected
            ?.logo_storage_path ||
            '',
        )
      }

      const result =
        update
          ? await updateClientAction(
              formData,
            )
          : await createClientAction(
              formData,
            )

      if (
        'error' in result
      ) {
        if (
          uploadedPath
        ) {
          await supabase
            .storage
            .from(
              'client-logos',
            )
            .remove([
              uploadedPath,
            ])
        }

        setError(
          result.error ||
            'Erro ao salvar cliente.',
        )

        setLoading(false)
        return
      }

      if (
        oldStoragePath &&
        (
          uploadedPath ||
          removeLogo
        ) &&
        oldStoragePath !==
          uploadedPath
      ) {
        await supabase
          .storage
          .from(
            'client-logos',
          )
          .remove([
            oldStoragePath,
          ])
      }

      window.location.reload()
    } catch (failure: any) {
      if (uploadedPath) {
        await supabase
          .storage
          .from(
            'client-logos',
          )
          .remove([
            uploadedPath,
          ])
      }

      setError(
        failure?.message ||
          'Erro ao processar a logo do cliente.',
      )

      setLoading(false)
    }
  }

  async function submitService(
    event:
      React.FormEvent<
        HTMLFormElement
      >,
  ) {
    event.preventDefault()

    setLoading(true)
    setError('')

    const result =
      await createClientServiceAction(
        new FormData(
          event.currentTarget,
        ),
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao vincular serviço.',
      )

      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function archiveSelected(
    mode:
      | 'archived'
      | 'inactive',
  ) {
    if (!selected) {
      return
    }

    const label =
      mode === 'archived'
        ? 'arquivar'
        : 'excluir da operação'

    if (
      !confirm(
        'Deseja ' +
          label +
          ' este cliente? O histórico será preservado.',
      )
    ) {
      return
    }

    setLoading(true)

    const result =
      await archiveClientAction(
        selected.id,
        mode,
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao atualizar cliente.',
      )

      setLoading(false)
      return
    }

    window.location.reload()
  }

  return (
    <div className="page-wrap clients-page ops-page clients-a21">
      <div className="topbar clients-topbar">
        <div>
          <div className="tb-title">
            Painel de Clientes
          </div>

          <div className="tb-sub">
            {activeCount} ativo(s)
            {' · '}
            {inactiveCount} inativo(s)
            {' · '}
            {parallelCount} paralelo(s)
            {' · '}
            {archivedCount} arquivado(s)
          </div>
        </div>

        <button
          className="bpri"
          onClick={
            startNewClient
          }
        >
          <i className="ti ti-plus" />

          Novo cliente
        </button>
      </div>

      <div className="client-filters-bar clients-a21-filters">
        <div className="sbox">
          <i className="ti ti-search" />

          <input
            value={query}
            onChange={(
              event,
            ) =>
              setQuery(
                event.target
                  .value,
              )
            }
            placeholder="Filtrar por nome, contato, segmento ou cidade..."
          />
        </div>

        <select
          className="fi compact"
          value={statusScope}
          onChange={(
            event,
          ) =>
            setStatusScope(
              event.target
                .value,
            )
          }
          aria-label="Filtrar situação"
        >
          <option value="active">
            Somente ativos
          </option>

          <option value="inactive">
            Inativos
          </option>

          <option value="archived">
            Arquivados
          </option>

          <option value="all">
            Todos
          </option>
        </select>

        <select
          className="fi compact"
          value={modelScope}
          onChange={(
            event,
          ) =>
            setModelScope(
              event.target
                .value,
            )
          }
          aria-label="Filtrar modelo operacional"
        >
          <option value="all">
            Todos os modelos
          </option>

          {OPERATION_MODELS.map(
            ([
              id,
              label,
            ]) => (
              <option
                key={id}
                value={id}
              >
                {label}
              </option>
            ),
          )}
        </select>

        <select
          className="fi compact"
          value={dateScope}
          onChange={(
            event,
          ) =>
            setDateScope(
              event.target
                .value,
            )
          }
          aria-label="Filtrar término do contrato"
        >
          <option value="all">
            Todos os términos
          </option>

          <option value="expired">
            Contrato vencido
          </option>

          <option value="next30">
            Término em 30 dias
          </option>

          <option value="next90">
            Término em 90 dias
          </option>

          <option value="no_end">
            Sem data final
          </option>
        </select>

        <span className="filter-summary">
          {filteredClients.length} cliente(s)
          {' · '}
          {statusScopeLabel(
            statusScope,
          )}
          {' · '}
          {modelScope ===
          'all'
            ? 'Todos os modelos'
            : operationModelLabel(
                modelScope,
              )}
          {' · '}
          {dateFilterLabel(
            dateScope,
          )}
        </span>
      </div>

      <div className="client-layout">
        <main className="client-table-wrap">
          {safeLoadErrors.length >
            0 && (
            <div className="notice notice-err">
              <i className="ti ti-alert-circle" />

              <span>
                {safeLoadErrors.join(
                  ' | ',
                )}
              </span>
            </div>
          )}

          <table className="client-table clients-a21-table">
            <thead>
              <tr>
                <th>
                  Cliente
                </th>

                <th>
                  Segmento
                </th>

                <th>
                  Cidade
                </th>

                <th>
                  Modelo
                </th>

                <th>
                  Serviços
                </th>

                <th>
                  Início
                </th>

                <th>
                  Término
                </th>

                <th>
                  Situação
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredClients.map(
                (
                  client: any,
                ) => {
                  const linked =
                    safeClientServices.filter(
                      (
                        service:
                          any,
                      ) =>
                        service.client_id ===
                          client.id &&
                        String(
                          service.status ||
                          'active',
                        ) ===
                          'active',
                    )

                  return (
                    <tr
                      key={
                        client.id
                      }
                      className={
                        selected?.id ===
                        client.id
                          ? 'selected'
                          : ''
                      }
                      onClick={() =>
                        selectClient(
                          client,
                        )
                      }
                    >
                      <td>
                        <div className="client-name">
                          <ClientLogo
                            client={
                              client
                            }
                          />

                          <div>
                            <b>
                              {text(
                                client.name,
                                'Cliente sem nome',
                              )}
                            </b>

                            <small>
                              {text(
                                client.main_contact_phone,
                                'Sem telefone',
                              )}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        {text(
                          client.segment,
                        )}
                      </td>

                      <td>
                        {text(
                          client.cidade,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            'client-operation-tag ' +
                            operationModelClass(
                              client.operation_model,
                            )
                          }
                        >
                          {operationModelLabel(
                            client.operation_model,
                          )}
                        </span>
                      </td>

                      <td>
                        {linked.length
                          ? String(
                              linked.length,
                            ) +
                            ' ativo' +
                            (
                              linked.length >
                              1
                                ? 's'
                                : ''
                            )
                          : 'Sem serviço ativo'}
                      </td>

                      <td>
                        {formatDate(
                          client.inicio_contrato ||
                            client.started_at,
                        )}
                      </td>

                      <td>
                        {formatDate(
                          client.fim_contrato ||
                            client.ended_at,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            'badge ' +
                            statusClass(
                              client.status,
                            )
                          }
                        >
                          {statusLabel(
                            client.status,
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                },
              )}
            </tbody>
          </table>

          {!filteredClients.length && (
            <div className="empty-state">
              <i className="ti ti-users-off" />

              <b>
                Nenhum cliente encontrado
              </b>

              <span>
                Ajuste os filtros para visualizar outros cadastros.
              </span>
            </div>
          )}
        </main>

        {selected && (
          <aside className="client-panel">
            <header className="client-panel-header clients-a21-panel-header">
              <ClientLogo
                client={selected}
                size="large"
              />

              <div>
                <b>
                  {text(
                    selected.name,
                    'Cliente',
                  )}
                </b>

                <span>
                  {text(
                    selected.segment,
                    'Sem segmento',
                  )}
                  {' · '}
                  {text(
                    selected.cidade,
                    'Sem cidade',
                  )}
                </span>

                <div className="client-header-tags">
                  <span
                    className={
                      'badge ' +
                      statusClass(
                        selected.status,
                      )
                    }
                  >
                    {statusLabel(
                      selected.status,
                    )}
                  </span>

                  <span
                    className={
                      'client-operation-tag ' +
                      operationModelClass(
                        selected.operation_model,
                      )
                    }
                  >
                    {operationModelLabel(
                      selected.operation_model,
                    )}
                  </span>
                </div>
              </div>

              <button
                className="mclose"
                onClick={() =>
                  setSelectedId(
                    null,
                  )
                }
              >
                <i className="ti ti-x" />
              </button>
            </header>

            <div className="client-tabs">
              {TABS.map(
                (name) => (
                  <button
                    key={name}
                    className={
                      tab === name
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      setTab(name)
                    }
                  >
                    {name}
                  </button>
                ),
              )}
            </div>

            <div className="client-panel-body">
              {tab ===
                'Visão geral' && (
                <>
                  <Info
                    label="Responsável"
                    value={text(
                      selected
                        .responsible
                        ?.full_name,
                      'Não definido',
                    )}
                  />

                  <Info
                    label="Contato"
                    value={text(
                      selected.main_contact_name,
                      'Não definido',
                    )}
                  />

                  <Info
                    label="E-mail"
                    value={text(
                      selected.main_contact_email,
                      'Não definido',
                    )}
                  />

                  <Info
                    label="Telefone"
                    value={text(
                      selected.main_contact_phone,
                      'Não definido',
                    )}
                  />

                  <Info
                    label="Instagram"
                    value={text(
                      selected.instagram,
                      'Não informado',
                    )}
                  />

                  <Info
                    label="Situação"
                    value={statusLabel(
                      selected.status,
                    )}
                  />

                  <Info
                    label="Modelo operacional"
                    value={operationModelLabel(
                      selected.operation_model,
                    )}
                  />

                  <Info
                    label="Contrato"
                    value={
                      formatDate(
                        selected.inicio_contrato ||
                          selected.started_at,
                      ) +
                      ' → ' +
                      formatDate(
                        selected.fim_contrato ||
                          selected.ended_at,
                      )
                    }
                  />

                  <div className="notice notice-warn">
                    <i className="ti ti-shield" />

                    <span>
                      Valores financeiros não aparecem no painel operacional.
                    </span>
                  </div>

                  <div className="client-documents-card">
                    <div className="stitle">
                      Documentos principais
                    </div>

                    <a
                      className={
                        'quick-link ' +
                        (
                          selected.strategic_map_url
                            ? ''
                            : 'disabled'
                        )
                      }
                      href={
                        selected.strategic_map_url ||
                        '#'
                      }
                      target="_blank"
                      rel="noreferrer"
                      onClick={(
                        event,
                      ) =>
                        !selected.strategic_map_url &&
                        event.preventDefault()
                      }
                    >
                      <i className="ti ti-map-2" />

                      {selected.strategic_map_url
                        ? 'Abrir Mapa Estratégico'
                        : 'Mapa Estratégico não cadastrado'}
                    </a>

                    <a
                      className={
                        'quick-link ' +
                        (
                          selected.drive_folder_url
                            ? ''
                            : 'disabled'
                        )
                      }
                      href={
                        selected.drive_folder_url ||
                        '#'
                      }
                      target="_blank"
                      rel="noreferrer"
                      onClick={(
                        event,
                      ) =>
                        !selected.drive_folder_url &&
                        event.preventDefault()
                      }
                    >
                      <i className="ti ti-brand-google-drive" />

                      {selected.drive_folder_url
                        ? 'Abrir pasta do Drive'
                        : 'Pasta do Drive não cadastrada'}
                    </a>
                  </div>

                  {selected.notes && (
                    <div className="client-notes">
                      {selected.notes}
                    </div>
                  )}
                </>
              )}

              {tab ===
                'Mapa de calor' &&
                heat && (
                  <div className="heat-card">
                    <div className="stitle">
                      Mapa de calor do cliente
                    </div>

                    <p>
                      Leitura inicial baseada em demandas, atrasos e entregas.
                    </p>

                    <div className="heat-track">
                      <span>
                        Moral alta
                      </span>

                      <span>
                        Risco maior
                      </span>
                    </div>

                    <div className="heat-position">
                      <div
                        style={{
                          left:
                            String(
                              heat.risk,
                            ) + '%',
                        }}
                      >
                        {initials(
                          selected.name,
                        )}
                      </div>
                    </div>

                    <div className="heat-metrics">
                      <b>
                        {heat.deliveryRate}% entrega
                      </b>

                      <b>
                        {heat.late} atraso(s)
                      </b>

                      <b>
                        {heat.active} aberta(s)
                      </b>
                    </div>
                  </div>
                )}

              {tab ===
                'Serviços' && (
                <>
                  <div className="sh">
                    <div className="stitle">
                      Serviços entregues/ativos
                    </div>

                    <button
                      className="text-button"
                      onClick={() => {
                        setError('')
                        setServiceModal(
                          true,
                        )
                      }}
                    >
                      <i className="ti ti-plus" />

                      Vincular
                    </button>
                  </div>

                  {selectedServices.length ? (
                    selectedServices.map(
                      (
                        service:
                          any,
                      ) => (
                        <div
                          className="service-card"
                          key={
                            service.id
                          }
                        >
                          <b>
                            {service
                              .service
                              ?.name ||
                              'Serviço'}
                          </b>

                          <span>
                            {statusLabel(
                              service.status,
                            )}
                          </span>

                          <small>
                            {service.monthly_quantity
                              ? String(
                                  service.monthly_quantity,
                                ) +
                                ' ' +
                                (
                                  service.quantity_unit ||
                                  'entregas'
                                ) +
                                ' / mês'
                              : 'Sem quantidade mensal'}

                            {service
                              .responsible
                              ?.full_name
                              ? ' · ' +
                                service
                                  .responsible
                                  .full_name
                              : ''}
                          </small>

                          <ClientServiceCycleSettings
                            service={
                              service
                            }
                          />
                        </div>
                      ),
                    )
                  ) : (
                    <div className="empty-inline">
                      Nenhum serviço ativo.
                    </div>
                  )}
                </>
              )}

              {tab ===
                'Demandas' && (
                <>
                  {selectedDemands.length ? (
                    selectedDemands.map(
                      (
                        demand:
                          any,
                      ) => (
                        <div
                          className="service-card"
                          key={
                            demand.id
                          }
                        >
                          <b>
                            {demand.title ||
                              'Demanda'}
                          </b>

                          <span>
                            {statusLabel(
                              demand.status,
                            )}
                          </span>

                          <small>
                            {formatDate(
                              demand.final_deadline ||
                                demand.internal_deadline,
                            )}
                            {' · '}
                            {demand.destino ||
                              'processo'}
                          </small>
                        </div>
                      ),
                    )
                  ) : (
                    <div className="empty-inline">
                      Nenhuma demanda ativa vinculada.
                    </div>
                  )}
                </>
              )}

              {tab ===
                'Documentos e Agenda' && (
                <>
                  <a
                    className={
                      'quick-link ' +
                      (
                        selected.strategic_map_url
                          ? ''
                          : 'disabled'
                      )
                    }
                    href={
                      selected.strategic_map_url ||
                      '#'
                    }
                    target="_blank"
                    rel="noreferrer"
                    onClick={(
                      event,
                    ) =>
                      !selected.strategic_map_url &&
                      event.preventDefault()
                    }
                  >
                    <i className="ti ti-map-2" />

                    {selected.strategic_map_url
                      ? 'Abrir Mapa Estratégico'
                      : 'Mapa Estratégico não cadastrado'}
                  </a>

                  <a
                    className={
                      'quick-link ' +
                      (
                        selected.drive_folder_url
                          ? ''
                          : 'disabled'
                      )
                    }
                    href={
                      selected.drive_folder_url ||
                      '#'
                    }
                    target="_blank"
                    rel="noreferrer"
                    onClick={(
                      event,
                    ) =>
                      !selected.drive_folder_url &&
                      event.preventDefault()
                    }
                  >
                    <i className="ti ti-brand-google-drive" />

                    {selected.drive_folder_url
                      ? 'Abrir pasta do Drive'
                      : 'Pasta do Drive não cadastrada'}
                  </a>

                  <p className="empty-inline">
                    A agenda será preenchida pelas agendas vinculadas ao cliente.
                  </p>
                </>
              )}

              {tab ===
                'Histórico' && (
                <p className="empty-inline">
                  Histórico operacional será ampliado após a estabilização dos fluxos centrais.
                </p>
              )}

              {edit && (
                <ClientForm
                  key={
                    selected.id
                  }
                  selected={
                    selected
                  }
                  profiles={
                    safeProfiles
                  }
                  loading={
                    loading
                  }
                  logoPreview={
                    logoPreview
                  }
                  onLogoFile={
                    handleLogoFile
                  }
                  onRemoveLogo={
                    requestLogoRemoval
                  }
                  onSubmit={(
                    event:
                      React.FormEvent<
                        HTMLFormElement
                      >,
                  ) =>
                    submitClient(
                      event,
                      true,
                    )
                  }
                />
              )}

              {error && (
                <div className="notice notice-err">
                  <i className="ti ti-alert-circle" />

                  <span>
                    {error}
                  </span>
                </div>
              )}
            </div>

            <footer className="client-actions">
              <button
                className="bsec"
                onClick={() => {
                  if (edit) {
                    setEdit(false)
                    setError('')
                  } else {
                    startEditClient()
                  }
                }}
              >
                {edit
                  ? 'Cancelar edição'
                  : 'Editar cadastro'}
              </button>

              <button
                className="bsec warn-action"
                onClick={() =>
                  archiveSelected(
                    'archived',
                  )
                }
              >
                Arquivar
              </button>

              <button
                className="bsec danger-action"
                onClick={() =>
                  archiveSelected(
                    'inactive',
                  )
                }
              >
                Excluir da operação
              </button>
            </footer>
          </aside>
        )}
      </div>

      {newModal && (
        <ClientModal
          title="Novo cliente"
          profiles={
            safeProfiles
          }
          error={error}
          loading={loading}
          logoPreview={
            logoPreview
          }
          onLogoFile={
            handleLogoFile
          }
          onRemoveLogo={
            requestLogoRemoval
          }
          onClose={() => {
            setNewModal(false)
            setError('')
          }}
          onSubmit={(
            event:
              React.FormEvent<
                HTMLFormElement
              >,
          ) =>
            submitClient(
              event,
              false,
            )
          }
        />
      )}

      {serviceModal &&
        selected && (
        <ServiceModal
          selected={selected}
          services={
            safeServices
          }
          profiles={
            safeProfiles
          }
          error={error}
          loading={loading}
          onClose={() =>
            setServiceModal(
              false,
            )
          }
          onSubmit={
            submitService
          }
        />
      )}
    </div>
  )
}

function Info({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="info-row">
      <span>
        {label}
      </span>

      <b>
        {value}
      </b>
    </div>
  )
}

function ClientForm({
  selected,
  profiles,
  loading,
  logoPreview,
  onLogoFile,
  onRemoveLogo,
  onSubmit,
}: any) {
  return (
    <form
      onSubmit={onSubmit}
      className="edit-client-form clients-a21-form"
    >
      <ClientFields
        key={
          selected.id ||
          'edit'
        }
        selected={selected}
        profiles={profiles}
        logoPreview={
          logoPreview
        }
        onLogoFile={
          onLogoFile
        }
        onRemoveLogo={
          onRemoveLogo
        }
      />

      <button
        className="bpri"
        disabled={loading}
      >
        {loading
          ? 'Salvando...'
          : 'Salvar cadastro'}
      </button>
    </form>
  )
}

function ClientModal({
  title,
  onClose,
  onSubmit,
  error,
  loading,
  profiles,
  logoPreview,
  onLogoFile,
  onRemoveLogo,
}: any) {
  return (
    <div
      className="modal-ov"
      onClick={onClose}
    >
      <div
        className="modal modal-wide clients-a21-modal"
        onClick={(
          event,
        ) =>
          event.stopPropagation()
        }
      >
        <div className="modal-head">
          <div>
            <div className="modal-title">
              {title}
            </div>

            <div className="modal-sub">
              Cadastre a identidade, situação e modelo operacional do cliente.
            </div>
          </div>

          <button
            className="mclose"
            onClick={onClose}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
        >
          <div className="modal-body clients-a21-modal-body">
            <ClientFields
              key="new-client"
              profiles={
                profiles
              }
              logoPreview={
                logoPreview
              }
              onLogoFile={
                onLogoFile
              }
              onRemoveLogo={
                onRemoveLogo
              }
            />

            {error && (
              <div className="notice notice-err">
                <i className="ti ti-alert-circle" />

                <span>
                  {error}
                </span>
              </div>
            )}
          </div>

          <div className="modal-foot">
            <button
              type="button"
              className="bsec"
              onClick={onClose}
            >
              Cancelar
            </button>

            <button
              className="bpri"
              disabled={loading}
            >
              {loading
                ? 'Cadastrando...'
                : 'Cadastrar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ClientFields({
  selected = {},
  profiles = [],
  logoPreview,
  onLogoFile,
  onRemoveLogo,
}: any) {
  const [
    operationModel,
    setOperationModel,
  ] = useState(
    selected.operation_model ||
      'monthly',
  )

  const situation =
    selected.status ===
      'active' ||
    !selected.status
      ? 'active'
      : 'inactive'

  const inputId =
    'client-logo-' +
    (
      selected.id ||
      'new'
    )

  return (
    <>
      <div className="client-form-section-title">
        Identificação
      </div>

      <div className="client-logo-upload">
        <div className="client-logo-upload-preview">
          {logoPreview ? (
            <img
              src={
                logoPreview
              }
              alt="Prévia da logo"
            />
          ) : (
            <span>
              {selected
                .avatar_initials ||
                initials(
                  selected.name,
                )}
            </span>
          )}
        </div>

        <div className="client-logo-upload-content">
          <b>
            Logo do cliente
          </b>

          <span>
            PNG, JPG ou WEBP. Máximo de 5 MB.
          </span>

          <div>
            <label
              className="bsec client-logo-button"
              htmlFor={
                inputId
              }
            >
              <i className="ti ti-upload" />

              Selecionar imagem
            </label>

            <input
              id={inputId}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(
                event,
              ) =>
                onLogoFile(
                  event.target
                    .files?.[0] ||
                    null,
                )
              }
            />

            {logoPreview && (
              <button
                type="button"
                className="text-button danger-text"
                onClick={
                  onRemoveLogo
                }
              >
                Remover logo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="fg">
        <label className="fl">
          Nome *
        </label>

        <input
          className="fi"
          name="name"
          required
          defaultValue={
            selected.name ||
            ''
          }
        />
      </div>

      <div className="frow">
        <div className="fg">
          <label className="fl">
            Segmento
          </label>

          <select
            className="fi"
            name="segment"
            defaultValue={
              selected.segment ||
              ''
            }
          >
            <option value="">
              Selecionar
            </option>

            {SEGMENTS.map(
              (segment) => (
                <option
                  key={segment}
                  value={segment}
                >
                  {segment}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="fg">
          <label className="fl">
            Cidade
          </label>

          <input
            className="fi"
            name="cidade"
            defaultValue={
              selected.cidade ||
              ''
            }
          />
        </div>
      </div>

      <div className="client-form-section-title">
        Operação
      </div>

      <div className="frow">
        <div className="fg">
          <label className="fl">
            Situação *
          </label>

          <select
            className="fi"
            name="status"
            required
            defaultValue={
              situation
            }
          >
            <option value="active">
              Ativo
            </option>

            <option value="inactive">
              Inativo
            </option>
          </select>
        </div>

        <div className="fg">
          <label className="fl">
            Modelo operacional *
          </label>

          <select
            className="fi"
            name="operation_model"
            required
            value={
              operationModel
            }
            onChange={(
              event,
            ) =>
              setOperationModel(
                event.target
                  .value,
              )
            }
          >
            {OPERATION_MODELS.map(
              ([
                id,
                label,
              ]) => (
                <option
                  key={id}
                  value={id}
                >
                  {label}
                </option>
              ),
            )}
          </select>

          <small className="field-help">
            {operationModel ===
            'parallel'
              ? 'Projeto ou trabalho pontual. O término é opcional.'
              : operationModel ===
                  'not_applicable'
                ? 'Cadastro sem contrato mensal ou projeto recorrente.'
                : 'Cliente recorrente da operação mensal.'}
          </small>
        </div>
      </div>

      <div className="fg">
        <label className="fl">
          Responsável
        </label>

        <select
          className="fi"
          name="responsible_id"
          defaultValue={
            selected.responsible_id ||
            ''
          }
        >
          <option value="">
            Definir depois
          </option>

          {profiles.map(
            (
              profile: any,
            ) => (
              <option
                key={
                  profile.id
                }
                value={
                  profile.id
                }
              >
                {
                  profile.full_name
                }
              </option>
            ),
          )}
        </select>
      </div>

      <div className="client-form-section-title">
        Contrato
      </div>

      <div className="frow">
        <div className="fg">
          <label className="fl">
            Início
          </label>

          <input
            type="date"
            className="fi"
            name="inicio_contrato"
            defaultValue={
              selected.inicio_contrato ||
              selected.started_at ||
              ''
            }
          />
        </div>

        <div className="fg">
          <label className="fl">
            Término
          </label>

          <input
            type="date"
            className="fi"
            name="fim_contrato"
            defaultValue={
              selected.fim_contrato ||
              selected.ended_at ||
              ''
            }
          />

          <small className="field-help">
            Opcional para clientes paralelos e não aplicáveis.
          </small>
        </div>
      </div>

      <div className="client-form-section-title">
        Contato
      </div>

      <div className="frow">
        <div className="fg">
          <label className="fl">
            Nome do contato
          </label>

          <input
            className="fi"
            name="main_contact_name"
            defaultValue={
              selected.main_contact_name ||
              ''
            }
          />
        </div>

        <div className="fg">
          <label className="fl">
            Telefone
          </label>

          <input
            className="fi"
            name="main_contact_phone"
            defaultValue={
              selected.main_contact_phone ||
              ''
            }
          />
        </div>
      </div>

      <div className="frow">
        <div className="fg">
          <label className="fl">
            E-mail
          </label>

          <input
            className="fi"
            type="email"
            name="main_contact_email"
            defaultValue={
              selected.main_contact_email ||
              ''
            }
          />
        </div>

        <div className="fg">
          <label className="fl">
            Instagram
          </label>

          <input
            className="fi"
            name="instagram"
            defaultValue={
              selected.instagram ||
              ''
            }
            placeholder="@cliente"
          />
        </div>
      </div>

      <div className="client-form-section-title">
        Documentos
      </div>

      <div className="fg">
        <label className="fl">
          Pasta geral do Drive
        </label>

        <input
          className="fi"
          type="url"
          name="drive_folder_url"
          defaultValue={
            selected.drive_folder_url ||
            ''
          }
          placeholder="https://drive.google.com/..."
        />
      </div>

      <div className="fg">
        <label className="fl">
          Mapa Estratégico
        </label>

        <input
          className="fi"
          type="url"
          name="strategic_map_url"
          defaultValue={
            selected.strategic_map_url ||
            selected.briefing_url ||
            ''
          }
          placeholder="Link do documento no Google Drive"
        />

        <small className="field-help">
          Documento principal de estratégia do cliente.
        </small>
      </div>

      <div className="fg">
        <label className="fl">
          Observações
        </label>

        <textarea
          className="fi"
          name="notes"
          rows={4}
          defaultValue={
            selected.notes ||
            ''
          }
        />
      </div>
    </>
  )
}

function ServiceModal({
  selected,
  services,
  profiles,
  error,
  loading,
  onClose,
  onSubmit,
}: any) {
  return (
    <div
      className="modal-ov"
      onClick={onClose}
    >
      <div
        className="modal"
        onClick={(
          event,
        ) =>
          event.stopPropagation()
        }
      >
        <div className="modal-head">
          <div className="modal-title">
            Vincular serviço
          </div>

          <button
            className="mclose"
            onClick={onClose}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
        >
          <div className="modal-body">
            <input
              type="hidden"
              name="client_id"
              value={
                selected.id
              }
            />

            <div className="fg">
              <label className="fl">
                Serviço *
              </label>

              <select
                className="fi"
                name="service_catalog_id"
                required
              >
                <option value="">
                  Selecionar
                </option>

                {services.map(
                  (
                    service:
                      any,
                  ) => (
                    <option
                      key={
                        service.id
                      }
                      value={
                        service.id
                      }
                    >
                      {
                        service.name
                      }
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="frow">
              <div className="fg">
                <label className="fl">
                  Quantidade mensal
                </label>

                <input
                  className="fi"
                  type="number"
                  min="0"
                  name="monthly_quantity"
                  placeholder="Ex.: 12"
                />
              </div>

              <div className="fg">
                <label className="fl">
                  Unidade
                </label>

                <select
                  className="fi"
                  name="quantity_unit"
                >
                  <option value="">
                    Não se aplica
                  </option>

                  <option value="conteúdos">
                    conteúdos
                  </option>

                  <option value="vídeos">
                    vídeos
                  </option>

                  <option value="entregas">
                    entregas
                  </option>
                </select>
              </div>
            </div>

            <div className="fg">
              <label className="fl">
                Responsável
              </label>

              <select
                className="fi"
                name="responsible_id"
              >
                <option value="">
                  Definir depois
                </option>

                {profiles.map(
                  (
                    profile:
                      any,
                  ) => (
                    <option
                      key={
                        profile.id
                      }
                      value={
                        profile.id
                      }
                    >
                      {
                        profile.full_name
                      }
                    </option>
                  ),
                )}
              </select>
            </div>


            <input
              type="hidden"
              name="cycle_settings_present"
              value="1"
            />

            <div className="client-service-link-cycle">
              <div className="fg">
                <label className="fl">
                  Duração do ciclo *
                </label>

                <div className="client-service-duration-input">
                  <input
                    className="fi"
                    type="number"
                    name="cycle_duration_days"
                    min="1"
                    max="365"
                    required
                    defaultValue="30"
                  />

                  <span>dias</span>
                </div>
              </div>

              <div className="client-service-cycle-options">
                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    name="requires_alignment_meeting"
                    defaultChecked
                  />

                  Exigir reunião de alinhamento
                </label>

                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    name="requires_capture"
                    defaultChecked
                  />

                  Exigir captação
                </label>
              </div>

              <div className="fg">
                <label className="fl">
                  Tipo padrão de captação
                </label>

                <select
                  className="fi"
                  name="default_capture_type"
                  defaultValue=""
                >
                  <option value="">
                    Definir no agendamento
                  </option>

                  <option value="cap_e">
                    Captação externa
                  </option>

                  <option value="cap_s">
                    Captação em estúdio
                  </option>
                </select>
              </div>
            </div>

            {error && (
              <div className="notice notice-err">
                <i className="ti ti-alert-circle" />

                <span>
                  {error}
                </span>
              </div>
            )}
          </div>

          <div className="modal-foot">
            <button
              className="bsec"
              type="button"
              onClick={onClose}
            >
              Cancelar
            </button>

            <button
              className="bpri"
              disabled={loading}
            >
              {loading
                ? 'Vinculando...'
                : 'Vincular serviço'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
