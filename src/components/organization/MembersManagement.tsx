"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { approveMembership, rejectMembership } from '@/app/dashboard/organization/actions'

interface Member {
  id: string
  name: string | null
  email: string
  isAdmin: boolean
  isApprovedMember: boolean
  isCurrentSession: boolean
}

interface PendingRequest {
  id: string
  userId: string
  userName: string | null
  userEmail: string
  joinedAt: Date
}

interface Props {
  organizationId: string
}

export function MembersManagement({ organizationId }: Props) {
  const { data: session } = useSession()
  const [members, setMembers] = useState<Member[]>([])
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdminDialog, setShowAdminDialog] = useState<string | null>(null)
  const [showActiveDialog, setShowActiveDialog] = useState<string | null>(null)
  const [adminActionError, setAdminActionError] = useState<string | null>(null)

  useEffect(() => {
    if (organizationId) {
      fetchData()
    }
  }, [organizationId])

  const fetchData = async () => {
    if (!organizationId) return;
    
    setLoading(true)
    try {
      const response = await fetch(`/api/user/memberships?organizationId=${organizationId}`)
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to fetch members')
      }
      const data = await response.json()

      // Split into active members and pending requests
      const activeMembers = data.filter((m: any) => m.isApprovedMember).map((m: any) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        isAdmin: m.isAdmin,
        isApprovedMember: m.isApprovedMember,
        isCurrentSession: m.isCurrentSession
      }))

      const pending = data.filter((m: any) => !m.isApprovedMember).map((m: any) => ({
        id: m.id,
        userId: m.id,
        userName: m.name,
        userEmail: m.email,
        joinedAt: new Date(m.joinedAt)
      }))
      
      setMembers(activeMembers)
      setPendingRequests(pending)
      setError(null)
    } catch (err) {
      console.error('Error fetching members:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const toggleAdmin = async (memberId: string) => {
    try {
      setAdminActionError(null)
      const response = await fetch(`/api/user/memberships/${memberId}/toggle-admin?organizationId=${organizationId}`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        if (errorText === 'Cannot remove the last admin of the organization') {
          setAdminActionError('Cannot remove the last admin. Please promote another member to admin first.')
          return
        }
        throw new Error(errorText || 'Failed to update admin status')
      }
      
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update admin status')
    }
  }

  const removeMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/user/memberships/${memberId}/remove?organizationId=${organizationId}`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to remove member')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const handleApprove = async (formData: FormData) => {
    formData.append('organizationId', organizationId)
    await approveMembership(formData)
    fetchData()
  }

  const handleReject = async (formData: FormData) => {
    formData.append('organizationId', organizationId)
    await rejectMembership(formData)
    fetchData()
  }

  if (loading) {
    return <div>Loading members...</div>
  }

  if (error) {
    return <div className="text-red-500">{error}</div>
  }

  const selectedMember = showAdminDialog || showActiveDialog 
    ? members.find(m => m.id === (showAdminDialog || showActiveDialog))
    : null

  return (
    <div className="space-y-8">
      {adminActionError && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                {adminActionError}
              </p>
            </div>
          </div>
        </div>
      )}

      {pendingRequests.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Pending Membership Requests</h2>
          <div className="space-y-4">
            {pendingRequests.map(request => (
              <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  {request.userName ? (
                    <>
                      <h3 className="font-medium">{request.userName}</h3>
                      <p className="text-sm text-gray-500">{request.userEmail}</p>
                    </>
                  ) : (
                    <h3 className="font-medium">{request.userEmail}</h3>
                  )}
                  <p className="text-sm text-gray-500">
                    Requested {request.joinedAt ? new Date(request.joinedAt).toLocaleDateString() : 'recently'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={handleApprove}>
                    <input type="hidden" name="membershipId" value={request.id} />
                    <Button type="submit" size="sm">
                      Approve
                    </Button>
                  </form>
                  <form action={handleReject}>
                    <input type="hidden" name="membershipId" value={request.id} />
                    <Button type="submit" variant="outline" size="sm">
                      Reject
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Active Members</h2>
        <div className="space-y-4">
          {members.map(member => (
            <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                {member.name ? (
                  <>
                    <h3 className="font-medium">{member.name}</h3>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </>
                ) : (
                  <h3 className="font-medium">{member.email}</h3>
                )}
                <div className="flex gap-2 mt-1">
                  {member.isAdmin && <Badge>Admin</Badge>}
                  {member.isCurrentSession && <Badge variant="secondary">Current Session</Badge>}
                  {member.isApprovedMember ? (
                    <Badge variant="secondary">Approved</Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAdminActionError(null)
                    setShowAdminDialog(member.id)
                  }}
                  disabled={member.id === session?.user?.id}
                >
                  {member.isAdmin ? 'Remove Admin' : 'Make Admin'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowActiveDialog(member.id)}
                  disabled={member.id === session?.user?.id}
                >
                  Remove Member
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Status Dialog */}
      {selectedMember && (
        <AlertDialog open={!!showAdminDialog} onOpenChange={() => {
          setShowAdminDialog(null)
          setAdminActionError(null)
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Admin Status Change</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to change the admin status for {selectedMember.name || selectedMember.email}?
                This will {selectedMember.isAdmin ? 'remove' : 'grant'} them administrative privileges.
                {selectedMember.isAdmin && (
                  <p className="mt-2 text-sm text-gray-500">
                    Note: You cannot remove admin status if they are the last admin. Make sure there is at least one other admin before removing admin privileges.
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setAdminActionError(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                if (showAdminDialog) {
                  toggleAdmin(showAdminDialog)
                  setShowAdminDialog(null)
                }
              }}>
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Remove Member Dialog */}
      {selectedMember && (
        <AlertDialog open={!!showActiveDialog} onOpenChange={() => setShowActiveDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Member Removal</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {selectedMember.name || selectedMember.email} from the organization?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  if (showActiveDialog) {
                    removeMember(showActiveDialog)
                    setShowActiveDialog(null)
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Remove Member
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
} 