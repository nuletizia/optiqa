import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get the organizationId from query params if it exists
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')

    if (organizationId) {
      // Admin checking other members
      const adminCheck = await prisma.$queryRaw<Array<{ isAdmin: boolean }>>`
        SELECT "isAdmin"
        FROM "UserOrganization"
        WHERE "userId" = ${session.user.id}
        AND "organizationId" = ${organizationId}
        AND "isApprovedMember" = true
        LIMIT 1
      `

      if (!adminCheck[0]?.isAdmin) {
        return new NextResponse('Unauthorized: Admin access required', { status: 401 })
      }

      // Get all members of the organization
      const members = await prisma.$queryRaw<Array<{
        id: string;
        name: string;
        email: string;
        isApprovedMember: boolean;
        isCurrentSession: boolean;
        isAdmin: boolean;
        joinedAt: Date;
      }>>`
        SELECT 
          "UserOrganization"."id",
          "User"."name",
          "User"."email",
          "UserOrganization"."isApprovedMember",
          "UserOrganization"."isCurrentSession",
          "UserOrganization"."isAdmin",
          "UserOrganization"."joinedAt"
        FROM "UserOrganization"
        JOIN "User" ON "User"."id" = "UserOrganization"."userId"
        WHERE "UserOrganization"."organizationId" = ${organizationId}
        ORDER BY "UserOrganization"."isAdmin" DESC, "User"."name" ASC NULLS LAST
      `

      return NextResponse.json(members)
    } else {
      // Get user's own memberships
      const memberships = await prisma.$queryRaw<Array<{
        id: string;
        organizationId: string;
        organizationName: string;
        isApprovedMember: boolean;
        isCurrentSession: boolean;
        isAdmin: boolean;
      }>>`
        SELECT 
          "UserOrganization"."id",
          "UserOrganization"."organizationId",
          "Organization"."name" as "organizationName",
          "UserOrganization"."isApprovedMember",
          "UserOrganization"."isCurrentSession",
          "UserOrganization"."isAdmin"
        FROM "UserOrganization"
        JOIN "Organization" ON "Organization"."id" = "UserOrganization"."organizationId"
        WHERE "UserOrganization"."userId" = ${session.user.id}
        ORDER BY "UserOrganization"."isCurrentSession" DESC, "Organization"."name" ASC
      `

      return NextResponse.json(memberships)
    }
  } catch (error) {
    console.error('Error in memberships API:', error)
    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Server Error',
      { status: 500 }
    )
  }
} 