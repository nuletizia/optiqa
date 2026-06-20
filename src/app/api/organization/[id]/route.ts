import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized - Please sign in',
        details: { session: !!session, userId: !!session?.user?.id }
      }, { status: 401 });
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        userOrganizations: {
          where: {
            userId: session.user.id,
            isCurrentSession: true,
            isApprovedMember: true
          },
          select: {
            isAdmin: true
          }
        }
      }
    });

    if (!organization) {
      return NextResponse.json({ 
        success: false,
        error: 'Organization not found'
      }, { status: 404 });
    }

    // Check if user is a member of the organization
    if (organization.userOrganizations.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized - Not a member of this organization'
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      ...organization,
      isAdmin: organization.userOrganizations[0].isAdmin
    });
  } catch (error) {
    console.error('GET /api/organization/[id] - Error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
} 