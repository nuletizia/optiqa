import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { redirect } from 'next/navigation'

export default async function SwitchOrganizationPage() {
  const session = await auth()
  
  if (!session?.user) {
    return null
  }

  // Get user's organization memberships
  const userMemberships = await prisma.$queryRaw<Array<{
    organizationId: string;
    organizationName: string;
    isApprovedMember: boolean;
    isCurrentSession: boolean;
    isAdmin: boolean;
  }>>`
    SELECT 
      "UserOrganization"."organizationId",
      "Organization"."name" as "organizationName",
      "UserOrganization"."isApprovedMember",
      "UserOrganization"."isCurrentSession",
      "UserOrganization"."isAdmin"
    FROM "UserOrganization"
    JOIN "Organization" ON "UserOrganization"."organizationId" = "Organization"."id"
    WHERE "UserOrganization"."userId" = ${session.user.id}
    ORDER BY "Organization"."name" ASC
  `

  // Server action to switch organization
  async function switchOrganization(formData: FormData) {
    'use server'
    const session = await auth()
    if (!session?.user) return

    const organizationId = formData.get('organizationId') as string
    if (!organizationId) return

    // Get the user's membership status in the selected organization
    const membership = await prisma.$queryRaw<Array<{ isApprovedMember: boolean; isAdmin: boolean }>>`
      SELECT "isApprovedMember", "isAdmin"
      FROM "UserOrganization"
      WHERE "userId" = ${session.user.id}
      AND "organizationId" = ${organizationId}
      LIMIT 1
    `

    // Allow switching if membership is approved or if user is admin
    if (membership.length === 0 || (!membership[0].isApprovedMember && !membership[0].isAdmin)) {
      return redirect('/dashboard/organization')
    }

    // Update all user's organizations to be inactive except the selected one
    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE "UserOrganization"
        SET "isCurrentSession" = false,
            "updatedAt" = NOW()
        WHERE "userId" = ${session.user.id}
        AND "organizationId" != ${organizationId}
      `,
      prisma.$executeRaw`
        UPDATE "UserOrganization"
        SET "isCurrentSession" = true,
            "updatedAt" = NOW()
        WHERE "userId" = ${session.user.id}
        AND "organizationId" = ${organizationId}
      `
    ])

    // Redirect to dashboard after switching
    redirect('/dashboard')
  }

  // Get the active organization
  const activeOrganization = userMemberships.find(m => m.isCurrentSession)

  // Show all memberships if user is admin in any organization
  const isAdminSomewhere = userMemberships.some(m => m.isAdmin)
  const availableMemberships = isAdminSomewhere ? userMemberships : userMemberships.filter(m => m.isApprovedMember)

  if (availableMemberships.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Card className="shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">No Active Organizations</CardTitle>
              <CardDescription className="text-base">
                You don't have any approved organization memberships. Please wait for an administrator to approve your membership request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <a href="/dashboard/organization/join">Request to Join Another Organization</a>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Switch Organization</CardTitle>
            <CardDescription className="text-base">
              Select which organization you want to work with.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={switchOrganization} className="space-y-6">
              <div className="space-y-4">
                <RadioGroup name="organizationId" className="space-y-3" defaultValue={activeOrganization?.organizationId || ''} required>
                  {availableMemberships.map(org => (
                    <div key={org.organizationId} className="flex items-center space-x-2">
                      <RadioGroupItem value={org.organizationId} id={org.organizationId} />
                      <Label htmlFor={org.organizationId} className="font-normal">
                        {org.organizationName} {org.isCurrentSession ? '(Current)' : ''} {org.isAdmin ? '(Admin)' : ''}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <Button type="submit" className="w-full">
                Switch Organization
              </Button>
            </form>
            <div className="mt-4">
              <Button variant="outline" asChild className="w-full mb-2">
                <a href="/dashboard/organization/join">Request to Join Another Organization</a>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <a href="/dashboard/organization/create">Create New Organization</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 