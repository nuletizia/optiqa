import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveOrganization } from '@/lib/auth/organization';
import { logger } from '@/lib/logger';

/**
 * How many comparisons the current user has recorded for each comparison set in
 * their active organization. Used by the dashboard "Comparisons to grade"
 * surface to show personal progress. Returns { progress: { [setId]: number } }.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please sign in' },
        { status: 401 },
      );
    }

    const activeOrg = await getActiveOrganization(session.user.id);
    if (!activeOrg) {
      return NextResponse.json(
        { success: false, error: 'No active organization' },
        { status: 403 },
      );
    }

    const rows = await prisma.$queryRaw<Array<{ comparisonSetId: string; total: number }>>`
      SELECT "comparisonSetId", SUM(comparisons)::int AS total
      FROM "DirectoryRating"
      WHERE "userId" = ${session.user.id}
        AND "organizationId" = ${activeOrg.organizationId}
        AND "comparisonSetId" IS NOT NULL
      GROUP BY "comparisonSetId"
    `;

    const progress: Record<string, number> = {};
    for (const row of rows) {
      progress[row.comparisonSetId] = Number(row.total) || 0;
    }

    return NextResponse.json({ success: true, progress });
  } catch (error) {
    logger.error('GET /api/organization/comparison-sets/progress failed', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
