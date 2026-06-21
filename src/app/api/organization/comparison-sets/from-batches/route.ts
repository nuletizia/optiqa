import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveOrganization } from '@/lib/auth/organization';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const JOB_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

/**
 * Create a ComparisonSet directly from two freshly-uploaded batches.
 *
 * Uploads land under an immutable job prefix `{org}/jobs/{jobId}/a|b/`, so the
 * comparison's human names (set name + batch labels) live here as metadata, not
 * in the folder names. We build the canonical directory paths server-side so
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

    // Any approved member of the active org may create a comparison
    // (getActiveOrganization already requires isApprovedMember = true).
    const activeOrg = await getActiveOrganization(session.user.id);
    if (!activeOrg) {
      return NextResponse.json(
        { success: false, error: 'No active organization' },
        { status: 403 },
      );
    }

    const { name, description, jobId, batchALabel, batchBLabel } = await request.json();

    if (!name || !jobId) {
      return NextResponse.json(
        { success: false, error: 'Please provide name and jobId' },
        { status: 400 },
      );
    }
    if (!JOB_ID_PATTERN.test(jobId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid job id' },
        { status: 400 },
      );
    }

    const orgPrefix = activeOrg.organizationName.toLowerCase();
    const directoryV1 = `${orgPrefix}/jobs/${jobId}/a/`;
    const directoryV2 = `${orgPrefix}/jobs/${jobId}/b/`;

    const comparisonSet = await prisma.comparisonSet.create({
      data: {
        name,
        description: description || null,
        directoryV1,
        directoryV2,
        batchALabel: batchALabel || null,
        batchBLabel: batchBLabel || null,
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
