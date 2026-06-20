import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveOrganization } from '@/lib/auth/organization';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's active organization
    const activeOrg = await getActiveOrganization(session.user.id);
    if (!activeOrg) {
      return NextResponse.json({ error: "No active organization" }, { status: 403 });
    }

    // Get unique products and directories from DirectoryRating
    const [results] = await prisma.$queryRaw<Array<{
      products: string[];
      directories: string[];
    }>>`
      SELECT
        ARRAY_AGG(DISTINCT product) as products,
        ARRAY_AGG(DISTINCT "directoryPath") as directories
      FROM "DirectoryRating"
      WHERE "organizationId" = ${activeOrg.organizationId}
    `;

    return NextResponse.json({
      products: results?.products || [],
      directories: results?.directories || []
    });
  } catch (error) {
    logger.error("GET /api/organization/products-and-directories failed", error);
    return NextResponse.json(
      { error: "Failed to fetch products and directories" },
      { status: 500 }
    );
  }
}
