import { redirect } from 'next/navigation'
import { requireTotalActor } from '@/lib/server-access'

export const dynamic = 'force-dynamic'

async function requireTotalAccess() {
  try { await requireTotalActor() } catch { redirect('/dashboard') }
}

export default async function TotalAccessLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireTotalAccess()

  return <>{children}</>
}
