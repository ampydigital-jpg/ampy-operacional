'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TOTAL_ACCESS = 'total'
const OPERATIONAL_ACCESS = 'operacional'
const TEAM_AVATAR_BUCKET = 'team-avatars'
const MAX_AVATAR_SIZE = 5 * 1024 * 1024
const AVATAR_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
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


function avatarFile(formData: FormData) {
  const value = formData.get('avatar_file')

  if (
    typeof File === 'undefined' ||
    !(value instanceof File) ||
    value.size === 0
  ) {
    return null
  }

  return value
}

function validateAvatar(file: File | null) {
  if (!file) {
    return null
  }

  if (!AVATAR_EXTENSIONS[file.type]) {
    return 'A foto precisa estar em JPG, JPEG, PNG ou WEBP.'
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return 'A foto precisa ter no máximo 5 MB.'
  }

  return null
}

function storedAvatarPath(url?: string | null) {
  if (!url) {
    return null
  }

  const marker =
    '/storage/v1/object/public/' +
    TEAM_AVATAR_BUCKET +
    '/'

  const index = url.indexOf(marker)

  if (index < 0) {
    return null
  }

  return decodeURIComponent(
    url.slice(index + marker.length),
  )
}

async function uploadAvatar(
  adminSupabase: ReturnType<typeof createAdminClient>,
  profileId: string,
  file: File,
) {
  const extension = AVATAR_EXTENSIONS[file.type]
  const path =
    profileId +
    '/avatar-' +
    Date.now() +
    '-' +
    Math.random().toString(36).slice(2, 10) +
    '.' +
    extension

  const bytes = Buffer.from(
    await file.arrayBuffer(),
  )

  const { error } = await adminSupabase.storage
    .from(TEAM_AVATAR_BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    throw new Error(error.message)
  }

  const { data } = adminSupabase.storage
    .from(TEAM_AVATAR_BUCKET)
    .getPublicUrl(path)

  return {
    path,
    url: data.publicUrl,
  }
}

async function removeAvatar(
  adminSupabase: ReturnType<typeof createAdminClient>,
  url?: string | null,
) {
  const path = storedAvatarPath(url)

  if (!path) {
    return
  }

  await adminSupabase.storage
    .from(TEAM_AVATAR_BUCKET)
    .remove([path])
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
  revalidatePath('/dashboard/demandas')
  revalidatePath('/dashboard/quadro')
  revalidatePath('/dashboard/projetos')
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard/avisos')
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
  const displayName =
    field(formData, 'display_name') || fullName
  const avatar = avatarFile(formData)
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

  if (!fullName || !displayName || !email || !jobTitle) {
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

  const avatarError = validateAvatar(avatar)

  if (avatarError) {
    return { error: avatarError }
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
      display_name: displayName,
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
  let uploadedAvatar: { path: string; url: string } | null = null

  try {
    if (avatar) {
      uploadedAvatar = await uploadAvatar(
        adminSupabase,
        profileId,
        avatar,
      )
    }
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .upsert(
        {
          id: profileId,
          full_name: fullName,
          display_name: displayName,
          avatar_url: uploadedAvatar?.url || null,
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
        display_name: displayName,
        avatar_url: uploadedAvatar?.url || null,
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
        display_name: displayName,
        avatar_url: uploadedAvatar?.url || null,
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
    if (uploadedAvatar?.url) {
      await removeAvatar(adminSupabase, uploadedAvatar.url)
    }

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
  const displayName =
    field(formData, 'display_name') || fullName
  const avatar = avatarFile(formData)
  const jobTitle = field(formData, 'job_title')
  const operationalArea = field(formData, 'operational_area')
  const accessType = field(formData, 'access_type')
  const isActive = boolField(formData, 'is_active')
  const receivesInternalAlerts = boolField(
    formData,
    'receives_internal_alerts',
  )

  if (!memberId || !fullName || !displayName || !jobTitle) {
    return {
      error: 'Dados do integrante incompletos.',
    }
  }

  const avatarError = validateAvatar(avatar)

  if (avatarError) {
    return { error: avatarError }
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
      'id,profile_id,email,full_name,display_name,avatar_url,job_title,access_type,operational_area,is_active,receives_internal_alerts',
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

  let uploadedAvatar: { path: string; url: string } | null = null

  try {
    if (avatar) {
      uploadedAvatar = await uploadAvatar(
        adminSupabase,
        current.profile_id,
        avatar,
      )
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar a foto.',
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
          display_name: displayName,
          avatar_url:
            uploadedAvatar?.url || current.avatar_url || null,
          job_title: jobTitle,
        },
      },
    )

  if (authError) {
    if (uploadedAvatar?.url) {
      await removeAvatar(adminSupabase, uploadedAvatar.url)
    }

    return {
      error: authError.message,
    }
  }

  const { error: profileError } = await adminSupabase
    .from('profiles')
    .update({
      full_name: fullName,
      display_name: displayName,
      avatar_url: uploadedAvatar?.url || current.avatar_url || null,
      job_title: jobTitle,
      team_area: operationalArea,
      role: roleForAccess(accessType),
      is_active: isActive,
      avatar_initials: initials(fullName),
      updated_at: new Date().toISOString(),
    })
    .eq('id', current.profile_id)

  if (profileError) {
    if (uploadedAvatar?.url) {
      await removeAvatar(adminSupabase, uploadedAvatar.url)
    }

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
      display_name: displayName,
      avatar_url: uploadedAvatar?.url || current.avatar_url || null,
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
    if (uploadedAvatar?.url) {
      await removeAvatar(adminSupabase, uploadedAvatar.url)
    }

    await adminSupabase
      .from('profiles')
      .update({
        full_name: current.full_name,
        display_name: current.display_name || current.full_name,
        avatar_url: current.avatar_url || null,
        job_title: current.job_title,
        team_area: current.operational_area,
        role: roleForAccess(current.access_type),
        is_active: current.is_active,
        avatar_initials: initials(current.full_name),
        updated_at: new Date().toISOString(),
      })
      .eq('id', current.profile_id)

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
      display_name: displayName,
      avatar_url: uploadedAvatar?.url || current.avatar_url || null,
      job_title: jobTitle,
      operational_area: operationalArea,
      access_type: accessType,
      is_active: isActive,
      receives_internal_alerts: receivesInternalAlerts,
    },
  })

  if (uploadedAvatar?.url && current.avatar_url) {
    await removeAvatar(adminSupabase, current.avatar_url)
  }

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

export async function updateOwnIdentityAction(
  formData: FormData,
) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { error: 'Sessão inválida.' }
  }

  const displayName = field(formData, 'display_name')
  const avatar = avatarFile(formData)

  if (displayName.length < 2) {
    return {
      error: 'Informe um nome de exibição com pelo menos 2 caracteres.',
    }
  }

  if (displayName.length > 80) {
    return {
      error: 'O nome de exibição pode ter no máximo 80 caracteres.',
    }
  }

  const avatarError = validateAvatar(avatar)

  if (avatarError) {
    return { error: avatarError }
  }

  const adminSupabase = createAdminClient()

  const [profileResult, memberResult] = await Promise.all([
    adminSupabase
      .from('profiles')
      .select('id,full_name,display_name,avatar_url')
      .eq('id', user.id)
      .single(),

    adminSupabase
      .from('team_members')
      .select('id,full_name,display_name,avatar_url')
      .eq('profile_id', user.id)
      .maybeSingle(),
  ])

  const profile = profileResult.data
  const member = memberResult.data

  if (!profile) {
    return { error: 'Perfil não encontrado.' }
  }

  let uploadedAvatar: { path: string; url: string } | null = null

  try {
    if (avatar) {
      uploadedAvatar = await uploadAvatar(
        adminSupabase,
        user.id,
        avatar,
      )
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar a foto.',
    }
  }

  const nextAvatarUrl =
    uploadedAvatar?.url ||
    profile.avatar_url ||
    member?.avatar_url ||
    null

  const { error: profileError } = await adminSupabase
    .from('profiles')
    .update({
      display_name: displayName,
      avatar_url: nextAvatarUrl,
      avatar_initials: initials(displayName),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (profileError) {
    if (uploadedAvatar?.url) {
      await removeAvatar(adminSupabase, uploadedAvatar.url)
    }

    return { error: profileError.message }
  }

  if (member) {
    const { error: memberError } = await adminSupabase
      .from('team_members')
      .update({
        display_name: displayName,
        avatar_url: nextAvatarUrl,
        avatar_initials: initials(displayName),
      })
      .eq('profile_id', user.id)

    if (memberError) {
      await adminSupabase
        .from('profiles')
        .update({
          display_name:
            profile.display_name || profile.full_name,
          avatar_url: profile.avatar_url || null,
          avatar_initials: initials(
            profile.display_name || profile.full_name,
          ),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (uploadedAvatar?.url) {
        await removeAvatar(adminSupabase, uploadedAvatar.url)
      }

      return { error: memberError.message }
    }
  }

  await adminSupabase.auth.admin.updateUserById(
    user.id,
    {
      user_metadata: {
        ...user.user_metadata,
        display_name: displayName,
        avatar_url: nextAvatarUrl,
      },
    },
  )

  await registerAudit(adminSupabase, {
    actorId: user.id,
    targetProfileId: user.id,
    targetEmail: user.email,
    action: 'own_identity_updated',
    oldValues: {
      display_name:
        profile.display_name || profile.full_name,
      avatar_url: profile.avatar_url || null,
    },
    newValues: {
      display_name: displayName,
      avatar_url: nextAvatarUrl,
    },
  })

  if (uploadedAvatar?.url && profile.avatar_url) {
    await removeAvatar(adminSupabase, profile.avatar_url)
  }

  revalidateAccessPaths()

  return { success: true }
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
