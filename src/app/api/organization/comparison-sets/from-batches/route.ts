import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveOrganization } from '@/lib/auth/organization';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const SEGMENT_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Create a ComparisonSet directly from two freshly-uploaded batches.
 *
 * The upload wizard knows a comparison only as `product` + two version names;
 * it does not (and should not) know the organization's S3 prefix. We build the
 * canonical `{org}/{product}/{version}/` directory paths here, server-side, so
 * they match exactly what the directories API and the evaluation flow expect.
 */
export async function POST(request: Request) {
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
    if (!activeOrg.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only organization admins can create comparison sets' },
        { status: 403 },
      );
    }

    const { name, description, product, versionA, versionB } = await request.json();

    if (!name || !product || !versionA || !versionB) {
      return NextResponse.json(
        { success: false, error: 'Please provide name, product, versionA and versionB' },
        { status: 400 },
      );
    }
    if (
      !SEGMENT_PATTERN.test(product) ||
      !SEGMENT_PATTERN.test(versionA) ||
      !SEGMENT_PATTERN.test(versionB)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid product or version name' },
        { status: 400 },
      );
    }

    const orgPrefix = activeOrg.organizationName.toLowerCase();
    const directoryV1 = `${orgPrefix}/${product}/${versionA}/`;
    const directoryV2 = `${orgPrefix}/${product}/${versionB}/`;

    const comparisonSet = await prisma.comparisonSet.create({
      data: {
        name,
        description: description || null,
        directoryV1,
        directoryV2,
        organizationId: activeOrg.organizationId,
        createdById: session.user.id,
      },
    });

    return NextResponse.json({ success: true, comparisonSet });
  } catch (error) {
    logger.error('POST /api/organization/comparison-sets/from-batches failed', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
