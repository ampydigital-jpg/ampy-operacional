'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import TeamMemberIdentity from '@/components/ui/TeamMemberIdentity'
import {
  changeOwnPasswordAction,
  updateOwnIdentityAction,
} from '@/lib/team-access-actions'

type AccountData = {
  full_name: string
  display_name: string | null
  avatar_url: string | null
  email: string
  job_title: string | null
  access_type: string
  operational_area: string
  must_change_password: boolean
  last_password_change_at: string | null
}

function areaLabel(value: string) {
  const labels: Record<string, string> = {
    gestao_operacional: 'Gestão Operacional',
    gestao_administrativa: 'Gestão Administrativa',
    captacao: 'Captação',
    edicao: 'Edição',
    operacoes: 'Operações',
    planejamento: 'Planejamento',
    design: 'Design',
    performance: 'Performance',
  }

  return labels[value] || value || 'Não definida'
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Ainda não registrada'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Ainda não registrada'
  }

  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default function MinhaContaView({
  account,
}: {
  account: AccountData
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const forced =
    account.must_change_password ||
    searchParams.get('troca') === 'obrigatoria'

  const [identityLoading, setIdentityLoading] = useState(false)
  const [identityError, setIdentityError] = useState('')
  const [identitySuccess, setIdentitySuccess] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  async function submitIdentity(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setIdentityLoading(true)
    setIdentityError('')
    setIdentitySuccess('')

    const result = await updateOwnIdentityAction(
      new FormData(event.currentTarget),
    )

    if (result?.error) {
      setIdentityError(result.error)
      setIdentityLoading(false)
      return
    }

    setIdentitySuccess('Perfil atualizado com sucesso.')
    setIdentityLoading(false)
    router.refresh()
  }

  async function submitPassword(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setPasswordLoading(true)
    setPasswordError('')
    setPasswordSuccess('')

    const result = await changeOwnPasswordAction(
      new FormData(event.currentTarget),
    )

    if (result?.error) {
      setPasswordError(result.error)
      setPasswordLoading(false)
      return
    }

    event.currentTarget.reset()
    setPasswordSuccess('Senha alterada com sucesso.')
    setPasswordLoading(false)
    router.refresh()
  }

  return (
    <div className="account-page">
      <header className="account-header">
        <div>
          <span className="eyebrow">CONTA, IDENTIDADE E SEGURANÇA</span>
          <h1>Minha Conta</h1>
          <p>
            Personalize seu nome e sua foto, além de controlar sua senha.
          </p>
        </div>
      </header>

      {forced ? (
        <div className="notice notice-warn account-password-warning">
          <i className="ti ti-shield-lock" />
          <span>
            Sua senha atual é temporária. Faça a troca antes de
            continuar utilizando a plataforma.
          </span>
        </div>
      ) : null}

      <div className="account-grid account-grid-identity">
        <section className="account-profile-card">
          <TeamMemberIdentity
            member={{
              ...account,
              is_active: true,
            }}
            size="xl"
            showMeta
          />

          <dl>
            <div>
              <dt>Nome completo</dt>
              <dd>{account.full_name}</dd>
            </div>

            <div>
              <dt>E-mail</dt>
              <dd>{account.email}</dd>
            </div>

            <div>
              <dt>Função</dt>
              <dd>{account.job_title || 'Não definida'}</dd>
            </div>

            <div>
              <dt>Área</dt>
              <dd>{areaLabel(account.operational_area)}</dd>
            </div>

            <div>
              <dt>Acesso</dt>
              <dd>
                {account.access_type === 'total'
                  ? 'Acesso Total'
                  : 'Acesso Operacional'}
              </dd>
            </div>

            <div>
              <dt>Última troca de senha</dt>
              <dd>{formatDateTime(account.last_password_change_at)}</dd>
            </div>
          </dl>
        </section>

        <section className="account-identity-card">
          <div>
            <span className="eyebrow">IDENTIDADE GLOBAL</span>
            <h2>Nome e foto</h2>
            <p>
              Estes dados serão usados em Demandas, Quadro, Projetos,
              Agenda, Avisos, Comunicação e Dashboards.
            </p>
          </div>

          <form onSubmit={submitIdentity}>
            <div className="fg">
              <label className="fl">Nome de exibição *</label>
              <input
                className="fi"
                name="display_name"
                defaultValue={
                  account.display_name || account.full_name
                }
                minLength={2}
                maxLength={80}
                required
              />
              <small className="field-help">
                O nome completo permanece preservado no cadastro.
              </small>
            </div>

            <div className="fg">
              <label className="fl">Foto do perfil</label>
              <input
                className="fi"
                name="avatar_file"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              />
              <small className="field-help">
                JPG, JPEG, PNG ou WEBP. Máximo de 5 MB.
              </small>
            </div>

            {identityError ? (
              <div className="notice notice-err">
                <i className="ti ti-alert-circle" />
                <span>{identityError}</span>
              </div>
            ) : null}

            {identitySuccess ? (
              <div className="notice notice-ok">
                <i className="ti ti-circle-check" />
                <span>{identitySuccess}</span>
              </div>
            ) : null}

            <button className="bpri" disabled={identityLoading}>
              {identityLoading ? 'Salvando...' : 'Salvar identidade'}
            </button>
          </form>
        </section>

        <section className="account-password-card">
          <div>
            <span className="eyebrow">SEGURANÇA</span>
            <h2>Alterar senha</h2>
            <p>
              Use uma senha exclusiva, com pelo menos 12 caracteres.
            </p>
          </div>

          <form onSubmit={submitPassword}>
            <div className="fg">
              <label className="fl">Senha atual *</label>
              <input
                className="fi"
                type="password"
                name="current_password"
                autoComplete="current-password"
                required
              />
            </div>

            <div className="fg">
              <label className="fl">Nova senha *</label>
              <input
                className="fi"
                type="password"
                name="new_password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </div>

            <div className="fg">
              <label className="fl">Confirmar nova senha *</label>
              <input
                className="fi"
                type="password"
                name="confirm_password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </div>

            <small className="field-help">
              A senha deve conter letra maiúscula, letra minúscula,
              número e caractere especial.
            </small>

            {passwordError ? (
              <div className="notice notice-err">
                <i className="ti ti-alert-circle" />
                <span>{passwordError}</span>
              </div>
            ) : null}

            {passwordSuccess ? (
              <div className="notice notice-ok">
                <i className="ti ti-circle-check" />
                <span>{passwordSuccess}</span>
              </div>
            ) : null}

            <button className="bpri" disabled={passwordLoading}>
              {passwordLoading ? 'Alterando...' : 'Alterar senha'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
