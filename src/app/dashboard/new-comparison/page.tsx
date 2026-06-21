import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { getActiveOrganization } from '@/lib/auth/organization'
import { UploadManagement } from '@/components/organization/UploadManagement'

// Any approved member of an organization can set up a comparison — not just admins.
export default async function NewComparisonPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const activeOrg = await getActiveOrganization(session.user.id)
  if (!activeOrg) {
    redirect('/dashboard/organization')
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">New comparison</h1>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to dashboard
            </Button>
          </Link>
        </div>
        <UploadManagement organizationId={activeOrg.organizationId} />
      </main>
    </div>
  )
}
