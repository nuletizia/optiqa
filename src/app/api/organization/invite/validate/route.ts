import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const session = await auth()
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const { code } = await request.json()
    
    if (!code) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })
    }
    
    // Find the invite code
    const inviteCode = await prisma.organizationInviteCode.findUnique({
      where: { code },
      include: { organization: true }
    })
    
    if (!inviteCode) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
    }
    
    // Check if the code has expired
    if (inviteCode.expiresAt && new Date(inviteCode.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Invite code has expired' }, { status: 400 })
    }
    
    // Check if the code has reached its usage limit
    if (inviteCode.usageLimit && inviteCode.usageCount >= inviteCode.usageLimit) {
      return NextResponse.json({ error: 'Invite code has reached its usage limit' }, { status: 400 })
    }
    
    // Check if user is already a member of this organization
    const existingMembership = await prisma.userOrganization.findFirst({
      where: {
        userId: session.user.id,
        organizationId: inviteCode.organizationId
      }
    })
    
    if (existingMembership) {
      return NextResponse.json({ 
        error: 'You are already a member of this organization',
        organizationId: inviteCode.organizationId,
        organizationName: inviteCode.organization.name
      }, { status: 400 })
    }
    
    return NextResponse.json({
      valid: true,
      organizationId: inviteCode.organizationId,
      organizationName: inviteCode.organization.name
    })
    
  } catch (error) {
    console.error('Error validating invite code:', error)
    return NextResponse.json({ error: 'Failed to validate invite code' }, { status: 500 })
  }
} 