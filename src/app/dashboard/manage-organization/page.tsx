import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MembersManagement } from '@/components/organization/MembersManagement'
import { RatingsManagement } from '@/components/organization/RatingsManagement'
import { ComparisonSetsManagement } from '@/components/organization/ComparisonSetsManagement'
import { FoldersManagement } from '@/components/organization/FoldersManagement'
import { UploadManagement } from '@/components/organization/UploadManagement'
import { prisma } from '@/lib/prisma'

export default async function ManageOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Get all organizations where user is admin
  const adminOrgs = await prisma.$queryRaw<Array<{ organizationId: string; isCurrentSession: boolean }>>`
    SELECT "organizationId", "isCurrentSession"
    FROM "UserOrganization"
    WHERE "userId" = ${session.user.id}
    AND "isAdmin" = true
  `

  // If no admin access anywhere, redirect
  if (adminOrgs.length === 0) {
    redirect('/dashboard/organization')
  }

  // Get the organization ID from the query params, current session, or first admin org
  const organizationId = typeof resolvedSearchParams?.organizationId === 'string'
    ? resolvedSearchParams.organizationId
    : adminOrgs.find(org => org.isCurrentSession)?.organizationId || adminOrgs[0].organizationId

  // Verify this org is in the admin orgs list
  if (!adminOrgs.some(org => org.organizationId === organizationId)) {
    redirect('/dashboard/organization')
  }

  // Get organization details
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  })

  if (!organization) {
    redirect('/dashboard/organization')
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="shadow-lg">
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Organization Management - {organization.name}</h1>
            <Tabs defaultValue="members" className="space-y-4">
              <TabsList>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="upload">Upload</TabsTrigger>
                <TabsTrigger value="folders">Folders</TabsTrigger>
                <TabsTrigger value="comparison-sets">Comparison Sets</TabsTrigger>
                <TabsTrigger value="ratings">Ratings</TabsTrigger>
              </TabsList>
              <TabsContent value="members">
                <MembersManagement organizationId={organizationId} />
              </TabsContent>
              <TabsContent value="upload">
                <UploadManagement organizationId={organizationId} />
              </TabsContent>
              <TabsContent value="folders">
                <FoldersManagement organizationId={organizationId} />
              </TabsContent>
              <TabsContent value="comparison-sets">
                <ComparisonSetsManagement organizationId={organizationId} />
              </TabsContent>
              <TabsContent value="ratings">
                <RatingsManagement organizationId={organizationId} />
              </TabsContent>
            </Tabs>
          </div>
        </Card>
      </main>
    </div>
  )
} 