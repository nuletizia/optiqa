import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveOrganization } from '@/lib/auth/organization';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
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

    // Verify user is an admin of the organization
    if (!activeOrg.isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        details: 'Only organization admins can reset ratings'
      }, { status: 403 });
    }

    // Get directories to reset from request body
    const { directories } = await request.json();
    if (!Array.isArray(directories) || directories.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request',
        details: 'Please provide an array of directory paths to reset'
      }, { status: 400 });
    }

    logger.debug('Resetting ratings for directories', {
      organizationId: activeOrg.organizationId,
      organizationName: activeOrg.organizationName,
      directories
    });

    // Delete ratings for the specified directories
    const result = await prisma.$executeRaw`
      DELETE FROM "DirectoryRating"
      WHERE "organizationId" = ${activeOrg.organizationId}
      AND "directoryPath" = ANY(${directories}::text[])
    `;

    logger.debug('Reset result', { rowsAffected: result });

    return NextResponse.json({
      success: true,
      message: `Ratings have been reset successfully for ${directories.length} directories in ${activeOrg.organizationName}`,
      details: {
        organizationId: activeOrg.organizationId,
        organizationName: activeOrg.organizationName,
        directoriesAffected: directories,
        rowsAffected: result
      }
    });
  } catch (error) {
    logger.error('POST /api/organization/ratings/reset-directories failed', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}
