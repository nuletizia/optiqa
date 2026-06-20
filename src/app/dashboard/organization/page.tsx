import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { redirect } from 'next/navigation'

export default async function OrganizationPage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Get user's active organization, membership details, and all members
  const [activeOrg, pendingRequests, members] = await Promise.all([
    prisma.$queryRaw<Array<{
      organizationId: string;
      organizationName: string;
      isAdmin: boolean;
      members: number;
    }>>`
      SELECT 
        "UserOrganization"."organizationId",
        "Organization"."name" as "organizationName",
        "UserOrganization"."isAdmin",
        (
          SELECT COUNT(*)::int 
          FROM "UserOrganization" uo 
          WHERE uo."organizationId" = "UserOrganization"."organizationId"
          AND uo."isApprovedMember" = true
        ) as members
      FROM "UserOrganization"
      JOIN "Organization" ON "UserOrganization"."organizationId" = "Organization"."id"
      WHERE "UserOrganization"."userId" = ${session.user.id}
      AND "UserOrganization"."isCurrentSession" = true
      LIMIT 1
    `,
    // Get pending requests if user is admin
    prisma.$queryRaw<Array<{
      id: string;
      userId: string;
      userName: string;
      userEmail: string;
      joinedAt: Date;
    }>>`
      SELECT 
        uo."id",
        uo."userId",
        u."name" as "userName",
        u."email" as "userEmail",
        uo."joinedAt"
      FROM "UserOrganization" uo
      JOIN "User" u ON u."id" = uo."userId"
      WHERE uo."organizationId" = (
        SELECT "organizationId"
        FROM "UserOrganization"
        WHERE "userId" = ${session.user.id}
        AND "isCurrentSession" = true
        LIMIT 1
      )
      AND uo."isApprovedMember" = false
      ORDER BY uo."joinedAt" DESC
    `,
    // Get all active members with their comparison counts
    prisma.$queryRaw<Array<{
      id: string;
      userId: string;
      userName: string;
      userEmail: string;
      joinedAt: Date;
      isAdmin: boolean;
      totalComparisons: number;
    }>>`
      SELECT 
        uo."id",
        uo."userId",
        u."name" as "userName",
        u."email" as "userEmail",
        uo."joinedAt",
        uo."isAdmin",
        COALESCE(
          (
            SELECT SUM(dr."comparisons")::int
            FROM "DirectoryRating" dr
            WHERE dr."userId" = u."id"
            AND dr."organizationId" = uo."organizationId"
          ),
          0
        ) as "totalComparisons"
      FROM "UserOrganization" uo
      JOIN "User" u ON u."id" = uo."userId"
      WHERE uo."organizationId" = (
        SELECT "organizationId"
        FROM "UserOrganization"
        WHERE "userId" = ${session.user.id}
        AND "isCurrentSession" = true
        LIMIT 1
      )
      AND uo."isApprovedMember" = true
      ORDER BY uo."isAdmin" DESC, "totalComparisons" DESC
    `
  ])

  if (!activeOrg[0]) {
    return (
      <div className="min-h-screen bg-white">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Card className="shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">No Active Organization</CardTitle>
              <CardDescription className="text-base">
                You are not currently active in any organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-700">
                  You can either join an existing organization using an invite code or create your own organization.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button asChild variant="outline" className="w-full">
                  <a href="/dashboard/organization/join">Join an Organization</a>
                </Button>
                
                <Button asChild className="w-full">
                  <a href="/dashboard/organization/create">Create New Organization</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const org = activeOrg[0]

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Organization Details</CardTitle>
            <CardDescription className="text-base">
              Your current organization information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Organization Name</h3>
                <p className="text-sm text-gray-600">{org.organizationName}</p>
              </div>
              <div>
                <h3 className="font-medium">Your Role</h3>
                <p className="text-sm text-gray-600">{org.isAdmin ? 'Administrator' : 'Member'}</p>
              </div>
              <div>
                <h3 className="font-medium">Active Members</h3>
                <p className="text-sm text-gray-600">{org.members}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Organization Members</CardTitle>
            <CardDescription className="text-base">
              View organization members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.userName || member.userEmail}</p>
                      {member.isAdmin && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">Joined {new Date(member.joinedAt).toLocaleDateString()}</p>
                    <p className="text-sm text-gray-600">Total Comparisons: {member.totalComparisons}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {org.isAdmin && pendingRequests.length > 0 && (
          <Card className="shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">Pending Membership Requests</CardTitle>
              <CardDescription className="text-base">
                {pendingRequests.length} pending request{pendingRequests.length !== 1 ? 's' : ''}. Visit the management page to handle these requests.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingRequests.map(request => (
                  <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{request.userName || request.userEmail}</p>
                      <p className="text-sm text-gray-600">Requested {new Date(request.joinedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {org.isAdmin && (
          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
              <a href="/dashboard/organization/invites">Manage Invite Codes</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/dashboard/manage-organization">Manage Organization</a>
            </Button>
          </div>
        )}
      </main>
    </div>
  )
} 