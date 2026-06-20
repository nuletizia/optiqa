import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth()
  
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Get current user's admin status
  const adminCheck = await prisma.$queryRaw<Array<{ isAdmin: boolean }>>`
    SELECT "isAdmin"
    FROM "UserOrganization"
    WHERE "userId" = ${session.user.id}
    AND "organizationId" = ${session.user.organizationId}
    AND "isApprovedMember" = true
    AND "isCurrentSession" = true
    LIMIT 1
  `

  if (!adminCheck[0]?.isAdmin) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Get the membership to remove
  const membership = await prisma.$queryRaw<Array<{ userId: string; isCurrentSession: boolean }>>`
    SELECT "userId", "isCurrentSession"
    FROM "UserOrganization"
    WHERE "id" = ${id}
    LIMIT 1
  `

  if (!membership[0]) {
    return new NextResponse('Membership not found', { status: 404 })
  }

  // Don't allow removing yourself
  if (membership[0].userId === session.user.id) {
    return new NextResponse('Cannot remove yourself', { status: 400 })
  }

  // If we're removing a current session, find another membership to make active
  if (membership[0].isCurrentSession) {
    // Find another approved membership for the user
    const [otherMembership] = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "UserOrganization"
      WHERE "userId" = ${membership[0].userId}
      AND "id" != ${id}
      AND "isApprovedMember" = true
      LIMIT 1
    `

    if (otherMembership) {
      // First deactivate all current sessions for this user
      await prisma.$executeRaw`
        UPDATE "UserOrganization"
        SET "isCurrentSession" = false,
            "updatedAt" = NOW()
        WHERE "userId" = ${membership[0].userId}
      `

      // Then set the other membership as current session
      await prisma.$executeRaw`
        UPDATE "UserOrganization"
        SET "isCurrentSession" = true,
            "updatedAt" = NOW()
        WHERE "id" = ${otherMembership.id}
      `
    }
  }

  // Delete the membership
  await prisma.$executeRaw`
    DELETE FROM "UserOrganization"
    WHERE "id" = ${id}
  `

  return new NextResponse(null, { status: 200 })
} 