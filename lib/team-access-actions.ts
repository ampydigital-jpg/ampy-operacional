'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TOTAL_ACCESS = 'total'
const OPERATIONAL_ACCESS = 'operacional'
const VALID_ACCESS_TYPES = [TOTAL_ACCESS, OPERATIONAL_ACCESS]
const VALID_AREAS = [
  'gestao_operacional',
  'gestao_administrativa',
  'captacao',
  'edicao',
  'operacoes',
  'planejamento',
  'design',
  'performance',
]

function field(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim()
}

function optional(formData: FormData, key: string) {
  const result = field(formData, key)
  return result || null
}

function boolField(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((item) => String(item))
    .includes('true')
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'AM'
  )
}

function validatePassword(password: string) {
  if (password.length < 12) {
    return 'A senha precisa ter pelo menos 12 caracteres.'
  }

  if (!/[a-z]/.test(password)) {
    return 'A senha precisa ter uma letra minúscula.'
  }

  if (!/[A-Z]/.test(password)) {
    return 'A senha precisa ter uma letra maiúscula.'
  }

  if (!/[0-9]/.test(password)) {
    return 'A senha precisa ter um número.'
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'A senha precisa ter um caractere especial.'
  }

  return null
}

function roleForAccess(accessType: string) {
  return accessType === TOTAL_ACCESS ? 'admin' : 'manager'
}

async function getTotalAccessActor() {
  const authSupabase = createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    return {
      error: 'Sessão inválida.',
    } as const
  }

  const adminSupabase = createAdminClient()

  let { data: actor } = await adminSupabase
    .from('team_members')
    .select('id,profile_id,email,full_name,access_type,is_active')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!actor && user.email) {
    const fallback = await adminSupabase
      .from('team_members')
      .select('id,profile_id,email,full_name,access_type,is_active')
      .eq('email', user.email)
      .maybeSingle()

    actor = fallback.data
  }

  if (
    !actor ||
    actor.access_type !== TOTAL_ACCESS ||
    actor.is_active !== true
  ) {
    return {
      error: 'Somente usuários com Acesso Total podem administrar a equipe.',
    } as const
  }

  return {
    user,
    actor,
    adminSupabase,
  } as const
}

async function registerAudit(
  adminSupabase: ReturnType<typeof createAdminClient>,
  input: {
    actorId: string
    targetProfileId?: string | null
    targetEmail: string
    action: string
    oldValues?: Record<string, unknown> | null
    newValues?: Record<string, unknown> | null
  },
) {
  await adminSupabase
    .from('team_access_audit')
    .insert({
      actor_id: input.actorId,
      target_profile_id: input.targetProfileId || null,
      target_email: input.targetEmail,
      action: input.action,
      old_values: input.oldValues || {},
      new_values: input.newValues || {},
    })
}

function revalidateAccessPaths() {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/equipe')
  revalidatePath('/dashboard/minha-conta')
  revalidatePath('/login')
}

export async function createTeamMemberAction(formData: FormData) {
  const access = await getTotalAccessActor()

  if ('error' in access) {
    return access
  }

  const {
    user,
    adminSupabase,
  } = access

  const fullName = field(formData, 'full_name')
  const email = field(formData, 'email').toLowerCase()
  const jobTitle = field(formData, 'job_title')
  const operationalArea = field(formData, 'operational_area')
  const accessType = field(formData, 'access_type')
  const password = field(formData, 'temporary_password')
  const receivesInternalAlerts = boolField(
    formData,
    'receives_internal_alerts',
  )
  const isActive = boolField(formData, 'is_active')

  if (!fullName || !email || !jobTitle) {
    return {
      error: 'Preencha nome, e-mail e função.',
    }
  }

  if (!email.includes('@')) {
    return {
      error: 'Informe um e-mail válido.',
    }
  }

  if (!VALID_ACCESS_TYPES.includes(accessType)) {
    return {
      error: 'Tipo de acesso inválido.',
    }
  }

  if (!VALID_AREAS.includes(operationalArea)) {
    return {
      error: 'Área operacional inválida.',
    }
  }

  const passwordError = validatePassword(password)

  if (passwordError) {
    return {
      error: passwordError,
    }
  }

  const { data: existingMember } = await adminSupabase
    .from('team_members')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingMember) {
    return {
      error: 'Já existe um integrante com este e-mail.',
    }
  }

  const {
    data: createdAuth,
    error: createAuthError,
  } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      job_title: jobTitle,
    },
  })

  if (createAuthError || !createdAuth.user) {
    return {
      error:
        createAuthError?.message ||
        'Não foi possível criar o usuário no Auth.',
    }
  }

  const profileId = createdAuth.user.id

  try {
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .upsert(
        {
          id: profileId,
          full_name: fullName,
          email,
          job_title: jobTitle,
          role: roleForAccess(accessType),
          team_area: operationalArea,
          is_active: isActive,
          avatar_initials: initials(fullName),
          avatar_color: '#FFFFFF',
          avatar_bg: '#3A3D43',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
        },
      )

    if (profileError) {
      throw new Error(profileError.message)
    }

    const { error: memberError } = await adminSupabase
      .from('team_members')
      .insert({
        profile_id: profileId,
        full_name: fullName,
        email,
        job_title: jobTitle,
        access_type: accessType,
        operational_area: operationalArea,
        is_active: isActive,
        receives_internal_alerts: receivesInternalAlerts,
        avatar_initials: initials(fullName),
        avatar_color: '#FFFFFF',
        avatar_bg: '#3A3D43',
        must_change_password: true,
        last_access_change_at: new Date().toISOString(),
        last_access_changed_by: user.id,
      })

    if (memberError) {
      throw new Error(memberError.message)
    }

    await registerAudit(adminSupabase, {
      actorId: user.id,
      targetProfileId: profileId,
      targetEmail: email,
      action: 'member_created',
      newValues: {
        full_name: fullName,
        job_title: jobTitle,
        operational_area: operationalArea,
        access_type: accessType,
        is_active: isActive,
      },
    })

    if (!isActive) {
      const { error: banError } =
        await adminSupabase.auth.admin.updateUserById(
          profileId,
          {
            ban_duration: '876000h',
          },
        )

      if (banError) {
        throw new Error(banError.message)
      }
    }
  } catch (error) {
    await adminSupabase.auth.admin.deleteUser(profileId)

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Falha ao concluir o cadastro do usuário.',
    }
  }

  revalidateAccessPaths()

  return {
    success: true,
  }
}

export async function updateTeamMemberAction(formData: FormData) {
  const access = await getTotalAccessActor()

  if ('error' in access) {
    return access
  }

  const {
    user,
    adminSupabase,
  } = access

  const memberId = field(formData, 'member_id')
  const fullName = field(formData, 'full_name')
  const jobTitle = field(formData, 'job_title')
  const operationalArea = field(formData, 'operational_area')
  const accessType = field(formData, 'access_type')
  const isActive = boolField(formData, 'is_active')
  const receivesInternalAlerts = boolField(
    formData,
    'receives_internal_alerts',
  )

  if (!memberId || !fullName || !jobTitle) {
    return {
      error: 'Dados do integrante incompletos.',
    }
  }

  if (!VALID_ACCESS_TYPES.includes(accessType)) {
    return {
      error: 'Tipo de acesso inválido.',
    }
  }

  if (!VALID_AREAS.includes(operationalArea)) {
    return {
      error: 'Área operacional inválida.',
    }
  }

  const {
    data: current,
    error: currentError,
  } = await adminSupabase
    .from('team_members')
    .select(
      'id,profile_id,email,full_name,job_title,access_type,operational_area,is_active,receives_internal_alerts',
    )
    .eq('id', memberId)
    .single()

  if (currentError || !current) {
    return {
      error: 'Integrante não encontrado.',
    }
  }

  if (!current.profile_id) {
    return {
      error: 'Este integrante ainda não possui vínculo com o Auth.',
    }
  }

  const editingSelf = current.profile_id === user.id

  if (editingSelf && (!isActive || accessType !== TOTAL_ACCESS)) {
    return {
      error: 'Você não pode remover o próprio Acesso Total nem desativar a própria conta.',
    }
  }

  if (
    current.access_type === TOTAL_ACCESS &&
    current.is_active === true &&
    (!isActive || accessType !== TOTAL_ACCESS)
  ) {
    const { count } = await adminSupabase
      .from('team_members')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('access_type', TOTAL_ACCESS)
      .eq('is_active', true)
      .neq('id', memberId)

    if (!count) {
      return {
        error: 'É necessário manter pelo menos um usuário ativo com Acesso Total.',
      }
    }
  }

  const previousBanDuration = current.is_active ? 'none' : '876000h'
  const nextBanDuration = isActive ? 'none' : '876000h'

  const { error: authError } =
    await adminSupabase.auth.admin.updateUserById(
      current.profile_id,
      {
        ban_duration: nextBanDuration,
        user_metadata: {
          full_name: fullName,
          job_title: jobTitle,
        },
      },
    )

  if (authError) {
    return {
      error: authError.message,
    }
  }

  const { error: profileError } = await adminSupabase
    .from('profiles')
    .update({
      full_name: fullName,
      job_title: jobTitle,
      team_area: operationalArea,
      role: roleForAccess(accessType),
      is_active: isActive,
      avatar_initials: initials(fullName),
      updated_at: new Date().toISOString(),
    })
    .eq('id', current.profile_id)

  if (profileError) {
    await adminSupabase.auth.admin.updateUserById(
      current.profile_id,
      {
        ban_duration: previousBanDuration,
      },
    )

    return {
      error: profileError.message,
    }
  }

  const { error: memberError } = await adminSupabase
    .from('team_members')
    .update({
      full_name: fullName,
      job_title: jobTitle,
      operational_area: operationalArea,
      access_type: accessType,
      is_active: isActive,
      receives_internal_alerts: receivesInternalAlerts,
      avatar_initials: initials(fullName),
      last_access_change_at: new Date().toISOString(),
      last_access_changed_by: user.id,
    })
    .eq('id', memberId)

  if (memberError) {
    await adminSupabase.auth.admin.updateUserById(
      current.profile_id,
      {
        ban_duration: previousBanDuration,
      },
    )

    return {
      error: memberError.message,
    }
  }

  await registerAudit(adminSupabase, {
    actorId: user.id,
    targetProfileId: current.profile_id,
    targetEmail: current.email,
    action: isActive ? 'member_updated' : 'member_deactivated',
    oldValues: current,
    newValues: {
      full_name: fullName,
      job_title: jobTitle,
      operational_area: operationalArea,
      access_type: accessType,
      is_active: isActive,
      receives_internal_alerts: receivesInternalAlerts,
    },
  })

  revalidateAccessPaths()

  return {
    success: true,
  }
}

export async function resetTeamMemberPasswordAction(
  formData: FormData,
) {
  const access = await getTotalAccessActor()

  if ('error' in access) {
    return access
  }

  const {
    user,
    adminSupabase,
  } = access

  const memberId = field(formData, 'member_id')
  const temporaryPassword = field(
    formData,
    'temporary_password',
  )

  const passwordError = validatePassword(temporaryPassword)

  if (passwordError) {
    return {
      error: passwordError,
    }
  }

  const {
    data: member,
    error: memberError,
  } = await adminSupabase
    .from('team_members')
    .select('id,profile_id,email,full_name')
    .eq('id', memberId)
    .single()

  if (memberError || !member?.profile_id) {
    return {
      error: 'Integrante sem vínculo válido com o Auth.',
    }
  }

  const { error: authError } =
    await adminSupabase.auth.admin.updateUserById(
      member.profile_id,
      {
        password: temporaryPassword,
      },
    )

  if (authError) {
    return {
      error: authError.message,
    }
  }

  const { error: updateError } = await adminSupabase
    .from('team_members')
    .update({
      must_change_password: true,
      last_access_change_at: new Date().toISOString(),
      last_access_changed_by: user.id,
    })
    .eq('id', memberId)

  if (updateError) {
    return {
      error: updateError.message,
    }
  }

  await registerAudit(adminSupabase, {
    actorId: user.id,
    targetProfileId: member.profile_id,
    targetEmail: member.email,
    action: 'password_reset_by_manager',
    newValues: {
      must_change_password: true,
    },
  })

  revalidateAccessPaths()

  return {
    success: true,
  }
}

export async function changeOwnPasswordAction(
  formData: FormData,
) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return {
      error: 'Sessão inválida.',
    }
  }

  const currentPassword = field(formData, 'current_password')
  const newPassword = field(formData, 'new_password')
  const confirmPassword = field(formData, 'confirm_password')

  if (!currentPassword) {
    return {
      error: 'Informe a senha atual.',
    }
  }

  if (newPassword !== confirmPassword) {
    return {
      error: 'A confirmação da nova senha não confere.',
    }
  }

  if (currentPassword === newPassword) {
    return {
      error: 'A nova senha precisa ser diferente da senha atual.',
    }
  }

  const passwordError = validatePassword(newPassword)

  if (passwordError) {
    return {
      error: passwordError,
    }
  }

  const { error: loginError } =
    await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

  if (loginError) {
    return {
      error: 'A senha atual está incorreta.',
    }
  }

  const { error: passwordUpdateError } =
    await supabase.auth.updateUser({
      password: newPassword,
    })

  if (passwordUpdateError) {
    return {
      error: passwordUpdateError.message,
    }
  }

  const adminSupabase = createAdminClient()
  const now = new Date().toISOString()

  await adminSupabase
    .from('team_members')
    .update({
      must_change_password: false,
      last_password_change_at: now,
    })
    .eq('profile_id', user.id)

  await registerAudit(adminSupabase, {
    actorId: user.id,
    targetProfileId: user.id,
    targetEmail: user.email,
    action: 'password_changed_by_user',
    newValues: {
      must_change_password: false,
      last_password_change_at: now,
    },
  })

  revalidateAccessPaths()

  return {
    success: true,
  }
}
