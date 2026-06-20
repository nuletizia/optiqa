import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth()
    
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get the organizationId from query params
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return new NextResponse('Organization ID is required', { status: 400 })
    }

    // Check if current user is an admin
    const adminCheck = await prisma.$queryRaw<Array<{ isAdmin: boolean }>>`
      SELECT "isAdmin"
      FROM "UserOrganization"
      WHERE "userId" = ${session.user.id}
      AND "organizationId" = ${organizationId}
      AND "isCurrentSession" = true
      AND "isApprovedMember" = true
      LIMIT 1
    `

    if (!adminCheck[0]?.isAdmin) {
      return new NextResponse('Unauthorized - Admin access required', { status: 401 })
    }

    // Get the target membership and check if it's going to be demoted from admin
    const [membership] = await prisma.$queryRaw<Array<{ isAdmin: boolean }>>`
      SELECT "isAdmin"
      FROM "UserOrganization"
      WHERE "id" = ${id}
      AND "organizationId" = ${organizationId}
      LIMIT 1
    `

    if (!membership) {
      return new NextResponse('Membership not found', { status: 404 })
    }

    // If we're removing admin status, check if this is the last admin
    if (membership.isAdmin) {
      // Count total admins in the organization
      const [{ adminCount }] = await prisma.$queryRaw<Array<{ adminCount: number }>>`
        SELECT COUNT(*)::int as "adminCount"
        FROM "UserOrganization"
        WHERE "organizationId" = ${organizationId}
        AND "isAdmin" = true
        AND "isApprovedMember" = true
      `

      // If this is the last admin, prevent the change
      if (adminCount <= 1) {
        return new NextResponse(
          'Cannot remove the last admin of the organization', 
          { status: 400 }
        )
      }
    }

    // Toggle admin status
    await prisma.$executeRaw`
      UPDATE "UserOrganization"
      SET 
        "isAdmin" = NOT "isAdmin",
        "updatedAt" = NOW()
      WHERE "id" = ${id}
      AND "organizationId" = ${organizationId}
    `

    return new NextResponse(null, { status: 200 })
  } catch (error) {
    console.error('Error in toggle-admin:', error)
    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Server Error',
      { status: 500 }
    )
  }
} 