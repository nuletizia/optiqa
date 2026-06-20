'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function approveMembership(formData: FormData) {
  const session = await auth()
  if (!session?.user) return

  const organizationId = formData.get('organizationId') as string
  if (!organizationId) return

  // Get current user's admin status
  const adminCheck = await prisma.$queryRaw<Array<{ isAdmin: boolean }>>`
    SELECT "isAdmin"
    FROM "UserOrganization"
    WHERE "userId" = ${session.user.id}
    AND "organizationId" = ${organizationId}
    AND "isApprovedMember" = true
    LIMIT 1
  `

  if (!adminCheck[0]?.isAdmin) {
    return
  }

  const membershipId = formData.get('membershipId') as string
  if (!membershipId) return

  // Approve the membership
  await prisma.$executeRaw`
    UPDATE "UserOrganization"
    SET "isApprovedMember" = true,
        "updatedAt" = NOW()
    WHERE "id" = ${membershipId}
  `

  revalidatePath('/dashboard/organization')
  revalidatePath('/dashboard/manage-organization')
}

export async function rejectMembership(formData: FormData) {
  const session = await auth()
  if (!session?.user) return

  const organizationId = formData.get('organizationId') as string
  if (!organizationId) return

  // Get current user's admin status
  const adminCheck = await prisma.$queryRaw<Array<{ isAdmin: boolean }>>`
    SELECT "isAdmin"
    FROM "UserOrganization"
    WHERE "userId" = ${session.user.id}
    AND "organizationId" = ${organizationId}
    AND "isApprovedMember" = true
    LIMIT 1
  `

  if (!adminCheck[0]?.isAdmin) {
    return
  }

  const membershipId = formData.get('membershipId') as string
  if (!membershipId) return

  // Delete the membership request
  await prisma.$executeRaw`
    DELETE FROM "UserOrganization"
    WHERE "id" = ${membershipId}
  `

  revalidatePath('/dashboard/organization')
  revalidatePath('/dashboard/manage-organization')
} 