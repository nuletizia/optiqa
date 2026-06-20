import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveOrganization } from '@/lib/auth/organization';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - Please sign in',
        details: { session: !!session, userId: !!session?.user?.id }
      }, { status: 401 });
    }

    // Get user's active organization
    const activeOrg = await getActiveOrganization(session.user.id);
    if (!activeOrg) {
      return NextResponse.json({
        success: false,
        error: 'No active organization',
        details: {
          userId: session.user.id,
          message: 'Please ensure you have an active organization membership'
        }
      }, { status: 403 });
    }

    logger.debug('Resetting ratings for organization', {
      organizationId: activeOrg.organizationId,
      organizationName: activeOrg.organizationName,
      isAdmin: activeOrg.isAdmin
    });

    // Verify user is an admin of the organization
    if (!activeOrg.isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        details: 'Only organization admins can reset ratings'
      }, { status: 403 });
    }

    // Delete all ratings for the organization
    const result = await prisma.$executeRaw`
      DELETE FROM "DirectoryRating"
      WHERE "organizationId" = ${activeOrg.organizationId}
    `;

    logger.debug('Reset result', { rowsAffected: result });

    return NextResponse.json({
      success: true,
      message: `All ratings have been reset successfully for ${activeOrg.organizationName}`,
      details: {
        organizationId: activeOrg.organizationId,
        organizationName: activeOrg.organizationName,
        rowsAffected: result
      }
    });
  } catch (error) {
    logger.error('POST /api/organization/ratings/reset failed', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}
