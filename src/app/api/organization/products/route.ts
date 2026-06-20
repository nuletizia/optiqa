import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveOrganization } from '@/lib/auth/organization';
import { listVersionDirectories } from '@/lib/directories';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const activeOrg = await getActiveOrganization(session.user.id);
    if (!activeOrg) {
      return NextResponse.json({ success: false, error: 'No active organization found' });
    }

    const directories = await listVersionDirectories(activeOrg.organizationName);
    const products = [...new Set(directories.map((dir) => dir.product))].sort();

    const dbProducts = await prisma.$queryRaw<Array<{ product: string }>>`
      SELECT DISTINCT product
      FROM "DirectoryRating"
      WHERE "organizationId" = ${activeOrg.organizationId}
      AND "comparisonSetId" IS NULL
      ORDER BY product
    `;

    return NextResponse.json({
      success: true,
      products: products.map((product) => ({
        name: product,
        path: product.toLowerCase(),
        hasRatings: dbProducts.some((p) => p.product === product),
        directories: directories.filter((d) => d.product === product),
      })),
    });
  } catch (error) {
    logger.error('GET /api/organization/products failed', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal Server Error',
    });
  }
}
