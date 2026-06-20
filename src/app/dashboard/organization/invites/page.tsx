import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { PlusCircle, Trash2 } from 'lucide-react'

// Define the type for the invite code
interface InviteCode {
  id: string;
  code: string;
  organizationId: string;
  createdAt: Date;
  expiresAt: Date | null;
  usageLimit: number | null;
  usageCount: number;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export default async function OrganizationInvitesPage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Get user's active organizations where they are an admin
  const userOrganizations = await prisma.userOrganization.findMany({
    where: {
      userId: session.user.id,
      isApprovedMember: true,
      isCurrentSession: true,
      isAdmin: true
    },
    include: {
      organization: true
    }
  })

  if (userOrganizations.length === 0) {
    redirect('/dashboard/organization')
  }

  // Server action to create a new invite code
  async function createInviteCode(formData: FormData) {
    'use server'
    
    const session = await auth()
    if (!session?.user) return

    const organizationId = formData.get('organizationId') as string
    if (!organizationId) return

    // Check if user is an admin of this organization
    const isAdmin = await prisma.userOrganization.findFirst({
      where: {
        userId: session.user.id,
        organizationId,
        isApprovedMember: true,
        isCurrentSession: true,
        isAdmin: true
      }
    })

    if (!isAdmin) {
      return redirect('/dashboard/organization')
    }

    // Generate a random 8-character code
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let result = ''
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return result
    }

    // Create the invite code
    await prisma.organizationInviteCode.create({
      data: {
        code: generateCode(),
        organizationId,
        createdById: session.user.id
      }
    })

    revalidatePath('/dashboard/organization/invites')
  }

  // Server action to delete an invite code
  async function deleteInviteCode(formData: FormData) {
    'use server'
    
    const session = await auth()
    if (!session?.user) return

    const inviteCodeId = formData.get('inviteCodeId') as string
    if (!inviteCodeId) return

    // Get the invite code to check organization
    const inviteCode = await prisma.organizationInviteCode.findUnique({
      where: { id: inviteCodeId }
    })

    if (!inviteCode) return

    // Check if user is an admin of this organization
    const isAdmin = await prisma.userOrganization.findFirst({
      where: {
        userId: session.user.id,
        organizationId: inviteCode.organizationId,
        isApprovedMember: true,
        isCurrentSession: true,
        isAdmin: true
      }
    })

    if (!isAdmin) {
      return redirect('/dashboard/organization')
    }

    // Delete the invite code
    await prisma.organizationInviteCode.delete({
      where: { id: inviteCodeId }
    })

    revalidatePath('/dashboard/organization/invites')
  }

  // Get all invite codes for the user's organizations
  const inviteCodes = await Promise.all(
    userOrganizations.map(async (org) => {
      const codes = await prisma.organizationInviteCode.findMany({
        where: {
          organizationId: org.organizationId
        },
        include: {
          createdBy: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      return {
        organization: org.organization,
        codes
      }
    })
  )

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Organization Invite Codes</h1>
        
        {inviteCodes.map((org) => (
          <Card key={org.organization.id} className="shadow-lg mb-8">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">{org.organization.name}</CardTitle>
              <CardDescription className="text-base">
                Manage invite codes for this organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <form action={createInviteCode} className="flex justify-end">
                  <input type="hidden" name="organizationId" value={org.organization.id} />
                  <Button type="submit" className="flex items-center gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Generate New Code
                  </Button>
                </form>
              </div>
              
              {org.codes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                      <tr>
                        <th className="px-6 py-3">Code</th>
                        <th className="px-6 py-3">Created By</th>
                        <th className="px-6 py-3">Created At</th>
                        <th className="px-6 py-3">Usage</th>
                        <th className="px-6 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {org.codes.map((code: InviteCode) => (
                        <tr key={code.id} className="bg-white border-b">
                          <td className="px-6 py-4 font-medium">{code.code}</td>
                          <td className="px-6 py-4">{code.createdBy?.name || 'System'}</td>
                          <td className="px-6 py-4">{format(new Date(code.createdAt), 'MMM d, yyyy')}</td>
                          <td className="px-6 py-4">
                            {code.usageCount} {code.usageLimit ? `/ ${code.usageLimit}` : ''}
                          </td>
                          <td className="px-6 py-4">
                            <form action={deleteInviteCode}>
                              <input type="hidden" name="inviteCodeId" value={code.id} />
                              <Button variant="destructive" size="sm" className="flex items-center gap-1">
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </Button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No invite codes found. Generate a new code to allow users to join this organization.
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  )
} 