import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveOrganization } from '@/lib/auth/organization';
import { listCommonPrefixes } from '@/lib/s3';
import { logger } from '@/lib/logger';

export async function GET() {
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

    // List all top-level folders in the bucket and remove trailing slashes
    const prefixes = await listCommonPrefixes();
    const folders = prefixes
      .map(prefix => prefix.replace(/\/$/, ''))
      .filter(Boolean);

    // Get ratings for these folders
    const ratings = await prisma.$queryRaw<Array<{
      directoryPath: string;
      totalRatings: string;
      averageRating: string | null;
    }>>`
      SELECT
        "directoryPath",
        COUNT(*)::text as "totalRatings",
        COALESCE(ROUND(AVG("rating"))::text, '0') as "averageRating"
      FROM "DirectoryRating"
      WHERE "organizationId" = ${activeOrg.organizationId}
      AND "directoryPath" = ANY(${folders}::text[])
      GROUP BY "directoryPath"
    `;

    // Create a map of ratings
    const ratingsMap = new Map(
      ratings.map(r => [r.directoryPath, {
        totalRatings: parseInt(r.totalRatings),
        averageRating: parseInt(r.averageRating || '0')
      }])
    );

    // Combine folder list with ratings
    const foldersWithRatings = folders.map(folder => ({
      path: folder,
      totalRatings: ratingsMap.get(folder)?.totalRatings || 0,
      averageRating: ratingsMap.get(folder)?.averageRating || 0
    }));

    return NextResponse.json({
      success: true,
      folders: foldersWithRatings
    });
  } catch (error) {
    logger.error('GET /api/organization/folders/list failed', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}
