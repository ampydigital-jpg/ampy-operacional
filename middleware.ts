import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Deixa o Next.js lidar com tudo — autenticação feita nas páginas
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
