import { auth } from '@/auth'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function ProfilePage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Get user's current organization name
  const userOrg = session.user.organizationId ? await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { name: true }
  }) : null;

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Profile</CardTitle>
            <CardDescription className="text-base">
              Your account information and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-3xl font-medium text-blue-700">
                  {session.user.name?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold">{session.user.name}</h3>
                <p className="text-sm text-gray-500">{session.user.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">Organization Status</h4>
                {session.user.organizationId ? (
                  <div className="space-y-2">
                    <p className="text-sm">
                      Organization: <span className="font-medium">{userOrg?.name || 'Unknown'}</span>
                    </p>
                    <p className="text-sm">
                      Status:{" "}
                      {session.user.isApprovedMember ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/20">
                          Pending Approval
                        </span>
                      )}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    You are not a member of any organization.{" "}
                    <a href="/dashboard/organization/join" className="text-blue-600 hover:text-blue-700 font-medium">
                      Join an organization
                    </a>
                  </p>
                )}
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">Account Details</h4>
                <div className="space-y-2">
                  <p className="text-sm">
                    Account Type: <span className="font-medium">Google Account</span>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 