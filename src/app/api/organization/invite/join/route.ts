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
    
    // Create the membership
    const [membership] = await prisma.$transaction([
      prisma.userOrganization.create({
        data: {
          userId: session.user.id,
          organizationId: inviteCode.organizationId,
          isApprovedMember: true, // Auto-approve when using invite code
          isCurrentSession: true, // Make it the current session
          joinedAt: new Date(),
          updatedAt: new Date()
        }
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { isActive: true }
      })
    ]);
    
    // Increment the usage count for the invite code
    await prisma.organizationInviteCode.update({
      where: { id: inviteCode.id },
      data: { usageCount: { increment: 1 } }
    })
    
    return NextResponse.json({
      success: true,
      organizationId: inviteCode.organizationId,
      organizationName: inviteCode.organization.name,
      membership
    })
    
  } catch (error) {
    console.error('Error joining organization:', error)
    return NextResponse.json({ error: 'Failed to join organization' }, { status: 500 })
  }
} 