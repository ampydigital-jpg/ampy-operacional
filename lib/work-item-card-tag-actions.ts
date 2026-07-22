'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  getCurrentProfile,
  isManager,
} from '@/lib/permissions'
import {
  createBoardPeriodDemandAction,
  updateBoardPeriodDemandAction,
} from '@/lib/actions'

const CARD_TAG_COLORS = [
  'slate',
  'blue',
  'purple',
  'yellow',
  'red',
  'green',
] as const

type CardTagColor =
  (typeof CARD_TAG_COLORS)[number]

function value(
  formData: FormData,
  key: string,
) {
  return String(
    formData.get(key) ||
    '',
  ).trim()
}

function normalizeTag(
  formData: FormData,
) {
  const tag =
    value(
      formData,
      'card_tag',
    )
      .replace(
        /\s+/g,
        ' ',
      )
      .toUpperCase()
      .slice(
        0,
        16,
      )

  return tag || null
}

function normalizeColor(
  formData: FormData,
): CardTagColor {
  const color =
    value(
      formData,
      'card_tag_color',
    )

  return CARD_TAG_COLORS.includes(
    color as CardTagColor,
  )
    ? color as CardTagColor
    : 'slate'
}

async function findCreatedWorkItemId(
  formData: FormData,
  userId: string,
) {
  const supabase =
    createClient()

  const boardId =
    value(
      formData,
      'board_id',
    )

  const clientId =
    value(
      formData,
      'client_id',
    )

  const initial =
    value(
      formData,
      'internal_deadline',
    )

  const final =
    value(
      formData,
      'final_deadline',
    )

  let query =
    supabase
      .from('work_items')
      .select('id')
      .eq(
        'created_by',
        userId,
      )
      .eq(
        'board_id',
        boardId,
      )
      .eq(
        'client_id',
        clientId,
      )
      .order(
        'created_at',
        {
          ascending: false,
        },
      )
      .limit(1)

  if (initial) {
    query =
      query.eq(
        'internal_deadline',
        initial,
      )
  }

  if (final) {
    query =
      query.eq(
        'final_deadline',
        final,
      )
  }

  const { data } =
    await query.maybeSingle()

  return data?.id || null
}

async function persistTag(
  workItemId: string,
  actorId: string,

  profileRole:
    Parameters<typeof isManager>[0],

  tag: string | null,
  color: CardTagColor,
) {
  const supabase =
    createClient()

  const {
    data: existing,
    error: readError,
  } =
    await supabase
      .from('work_items')
      .select(
        'id,card_tag,card_tag_color,responsible_id,created_by',
      )
      .eq(
        'id',
        workItemId,
      )
      .single()

  if (
    readError ||
    !existing
  ) {
    return {
      error:
        'Demanda criada, mas não foi possível localizar o card para salvar a tag.',
    }
  }

  if (
    !isManager(profileRole) &&
    existing.responsible_id !==
      actorId &&
    existing.created_by !==
      actorId
  ) {
    return {
      error:
        'Você não possui permissão para alterar a tag desta demanda.',
    }
  }

  const nextColor =
    tag
      ? color
      : 'slate'

  const { error } =
    await supabase
      .from('work_items')
      .update({
        card_tag:
          tag,

        card_tag_color:
          nextColor,
      })
      .eq(
        'id',
        workItemId,
      )

  if (error) {
    return {
      error:
        error.message,
    }
  }

  if (
    String(
      existing.card_tag ||
      '',
    ) !==
    String(
      tag ||
      '',
    )
  ) {
    await supabase
      .from('work_item_history')
      .insert({
        work_item_id:
          workItemId,

        actor_id:
          actorId,

        field_changed:
          'card_tag',

        old_value:
          existing.card_tag ||
          null,

        new_value:
          tag,
      })
  }

  if (
    String(
      existing.card_tag_color ||
      'slate',
    ) !==
    String(nextColor)
  ) {
    await supabase
      .from('work_item_history')
      .insert({
        work_item_id:
          workItemId,

        actor_id:
          actorId,

        field_changed:
          'card_tag_color',

        old_value:
          existing.card_tag_color ||
          'slate',

        new_value:
          nextColor,
      })
  }

  revalidatePath(
    '/dashboard/quadro',
  )

  revalidatePath(
    '/dashboard/demandas',
  )

  revalidatePath(
    '/dashboard',
  )

  return {
    success: true,
  }
}

export async function saveBoardPeriodDemandWithTagAction(
  mode:
    | 'create'
    | 'edit',

  workItemId:
    | string
    | null,

  formData:
    FormData,
) {
  const baseResult =
    mode === 'edit' &&
    workItemId
      ? await updateBoardPeriodDemandAction(
          workItemId,
          formData,
        )
      : await createBoardPeriodDemandAction(
          formData,
        )

  if (
    'error' in baseResult
  ) {
    return baseResult
  }

  const {
    user,
    profile,
  } =
    await getCurrentProfile()

  if (
    !user ||
    !profile
  ) {
    return {
      error:
        'Demanda salva, mas a sessão ficou indisponível ao salvar a tag.',
    }
  }

  const resolvedId =
    workItemId ||
    (
      'id' in baseResult &&
      typeof baseResult.id ===
        'string'
        ? baseResult.id
        : await findCreatedWorkItemId(
            formData,
            user.id,
          )
    )

  if (!resolvedId) {
    return {
      error:
        'Demanda salva, mas não foi possível identificar o novo card para salvar a tag.',
    }
  }

  const tagResult =
    await persistTag(
      resolvedId,
      user.id,
      profile.role,
      normalizeTag(formData),
      normalizeColor(formData),
    )

  if (
    'error' in tagResult
  ) {
    return tagResult
  }

  return {
    ...baseResult,
    id:
      resolvedId,
    success:
      true,
  }
}
