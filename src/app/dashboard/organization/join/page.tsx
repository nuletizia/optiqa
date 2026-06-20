import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import JoinForm from './JoinForm'

// Define the OrganizationInviteCode type
interface OrganizationInviteCode {
  id: string;
  code: string;
  organizationId: string;
  createdAt: Date;
  expiresAt: Date | null;
  usageLimit: number | null;
  usageCount: number;
  organization?: {
    id: string;
    name: string;
  };
}

// Define possible error types
export type ErrorType = 'invalid-code' | 'expired-code' | 'usage-limit-reached' | 'server-error' | null;

// Define the result type for the join action
export type JoinResult = {
  success: boolean;
  error: ErrorType;
};

export default async function JoinOrganizationPage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Server action to join an organization with invite code
  async function joinOrganization(formData: FormData): Promise<JoinResult> {
    'use server'
    
    const session = await auth()
    if (!session?.user) {
      return { success: false, error: 'server-error' };
    }

    const inviteCode = formData.get('inviteCode') as string
    if (!inviteCode) {
      return { success: false, error: 'invalid-code' };
    }

    try {
      // Find the invite code using raw SQL instead of Prisma client
      const inviteCodeRecords = await prisma.$queryRaw<OrganizationInviteCode[]>`
        SELECT 
          oic.*, 
          jsonb_build_object('id', o.id, 'name', o.name) as organization
        FROM "OrganizationInviteCode" oic
        JOIN "Organization" o ON oic."organizationId" = o.id
        WHERE oic.code = ${inviteCode}
        LIMIT 1
      `;
      
      const inviteCodeRecord = inviteCodeRecords.length > 0 ? inviteCodeRecords[0] : null;
      
      if (!inviteCodeRecord) {
        return { success: false, error: 'invalid-code' };
      }
      
      // Check if the code has expired
      if (inviteCodeRecord.expiresAt && new Date(inviteCodeRecord.expiresAt) < new Date()) {
        return { success: false, error: 'expired-code' };
      }
      
      // Check if the code has reached its usage limit
      if (inviteCodeRecord.usageLimit && inviteCodeRecord.usageCount >= inviteCodeRecord.usageLimit) {
        return { success: false, error: 'usage-limit-reached' };
      }

      // Check if user already has a membership
      const existingMembership = await prisma.userOrganization.findFirst({
        where: {
          userId: session.user.id,
          organizationId: inviteCodeRecord.organizationId
        }
      })

      if (existingMembership) {
        if (!existingMembership.isApprovedMember) {
          // Update the existing membership to be approved and make it the current session
          await prisma.userOrganization.update({
            where: { id: existingMembership.id },
            data: {
              isApprovedMember: true,
              isCurrentSession: true,
              updatedAt: new Date()
            }
          });

          // Deactivate other sessions
          await prisma.userOrganization.updateMany({
            where: {
              userId: session.user.id,
              id: { not: existingMembership.id }
            },
            data: {
              isCurrentSession: false,
              updatedAt: new Date()
            }
          });
        }
        revalidatePath('/dashboard/organization');
        return { success: true, error: null };
      }

      // First deactivate other sessions
      await prisma.userOrganization.updateMany({
        where: {
          userId: session.user.id,
          isCurrentSession: true
        },
        data: {
          isCurrentSession: false,
          updatedAt: new Date()
        }
      });

      // Then create new organization membership
      await prisma.userOrganization.create({
        data: {
          userId: session.user.id,
          organizationId: inviteCodeRecord.organizationId,
          isApprovedMember: true, // Auto-approve when using invite code
          isCurrentSession: true, // Make it the current session
          joinedAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      // Increment the usage count for the invite code using raw SQL
      await prisma.$executeRaw`
        UPDATE "OrganizationInviteCode"
        SET "usageCount" = "usageCount" + 1
        WHERE id = ${inviteCodeRecord.id}
      `;

      revalidatePath('/dashboard/organization');
      return { success: true, error: null };
    } catch (error) {
      console.error('Error joining organization:', error);
      return { success: false, error: 'server-error' };
    }
  }

  // Get user's current memberships
  const userMemberships = await prisma.$queryRaw<Array<{ 
    organizationId: string;
    isApprovedMember: boolean;
    isCurrentSession: boolean;
    organizationName: string;
  }>>`
    SELECT 
      "UserOrganization"."organizationId",
      "UserOrganization"."isApprovedMember",
      "UserOrganization"."isCurrentSession",
      "Organization"."name" as "organizationName"
    FROM "UserOrganization"
    JOIN "Organization" ON "UserOrganization"."organizationId" = "Organization"."id"
    WHERE "UserOrganization"."userId" = ${session.user.id}
  `;

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {userMemberships.length > 0 && (
          <Card className="shadow-lg mb-8">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">Current Memberships</CardTitle>
              <CardDescription className="text-base">
                Your organization membership status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userMemberships.map(membership => (
                  <div key={membership.organizationId} className={`rounded-lg p-4 ${
                    membership.isApprovedMember ? 'bg-green-50' : 'bg-yellow-50'
                  }`}>
                    <p className={`text-sm font-medium ${
                      membership.isApprovedMember ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      {membership.organizationName} 
                      {membership.isCurrentSession && ' (Current Session)'} - 
                      {membership.isApprovedMember ? 'Active Member' : 'Pending Approval'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Join Organization</CardTitle>
            <CardDescription className="text-base">
              Enter an invite code to join an organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JoinForm joinAction={joinOrganization} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 