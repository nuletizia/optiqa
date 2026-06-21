import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveOrganization } from '@/lib/auth/organization';
import { normalizeDirectoryPath } from '@/lib/paths';
import { logger } from '@/lib/logger';

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

    // Get personal ratings (excluding comparison set ratings)
    const personalRatings = await prisma.$queryRaw<Array<{
      directoryPath: string;
      rating: number;
      comparisons: number;
      lastUpdated: Date;
      organizationId: string;
      product: string;
      version: string;
    }>>`
      SELECT
        "directoryPath",
        rating,
        comparisons,
        "lastUpdated",
        "organizationId",
        product,
        version
      FROM "DirectoryRating"
      WHERE "userId" = ${session.user.id}
      AND "organizationId" = ${activeOrg.organizationId}
      AND "comparisonSetId" IS NULL
      ORDER BY "lastUpdated" DESC
    `;

    // Get comparison set ratings
    const comparisonSetRatings = await prisma.$queryRaw<Array<{
      directoryPath: string;
      rating: number;
      comparisons: number;
      lastUpdated: Date;
      organizationId: string;
      product: string;
      version: string;
      comparisonSetId: string;
      comparisonSetName: string;
      directoryV1: string;
      directoryV2: string;
      batchALabel: string | null;
      batchBLabel: string | null;
    }>>`
      SELECT
        dr."directoryPath",
        dr.rating,
        dr.comparisons,
        dr."lastUpdated",
        dr."organizationId",
        dr.product,
        dr.version,
        dr."comparisonSetId",
        cs.name as "comparisonSetName",
        cs."directoryV1",
        cs."directoryV2",
        cs."batchALabel",
        cs."batchBLabel"
      FROM "DirectoryRating" dr
      JOIN "ComparisonSet" cs ON cs.id = dr."comparisonSetId"
      WHERE dr."userId" = ${session.user.id}
      AND dr."organizationId" = ${activeOrg.organizationId}
      AND dr."comparisonSetId" IS NOT NULL
      ORDER BY dr."lastUpdated" DESC
    `;

    // Resolve a friendly display name for each set rating: the set's batch label
    // when present (job-id comparisons), else the version path segment.
    const setRatingDisplayName = (r: {
      directoryPath: string; version: string;
      directoryV1: string; directoryV2: string;
      batchALabel: string | null; batchBLabel: string | null;
    }): string => {
      const norm = (p: string) => normalizeDirectoryPath(p);
      if (norm(r.directoryPath) === norm(r.directoryV1) && r.batchALabel) return r.batchALabel;
      if (norm(r.directoryPath) === norm(r.directoryV2) && r.batchBLabel) return r.batchBLabel;
      return r.version;
    };

    // Group comparison set ratings
    const comparisonSetWeightedRatings = comparisonSetRatings.reduce((acc, curr) => {
      if (!acc[curr.comparisonSetId]) {
        acc[curr.comparisonSetId] = {
          id: curr.comparisonSetId,
          name: curr.comparisonSetName,
          ratings: []
        };
      }

      acc[curr.comparisonSetId].ratings.push({
        directoryPath: curr.directoryPath,
        rating: curr.rating,
        totalComparisons: curr.comparisons,
        lastUpdated: curr.lastUpdated.toISOString(),
        product: curr.product,
        version: curr.version,
        displayName: setRatingDisplayName(curr)
      });

      return acc;
    }, {} as Record<string, {
      id: string;
      name: string;
      ratings: Array<{
        directoryPath: string;
        rating: number;
        totalComparisons: number;
        lastUpdated: string;
        product: string;
        version: string;
        displayName: string;
      }>;
    }>);

    // Format comparison set ratings
    const formattedComparisonSetRatings = Object.values(comparisonSetWeightedRatings);

    // Get organization ratings (excluding comparison set ratings)
    const orgRatings = await prisma.$queryRaw<Array<{
      directoryPath: string;
      rating: number;
      comparisons: number;
      lastUpdated: Date;
      userId: string;
      organizationId: string;
      product: string;
      version: string;
    }>>`
      SELECT
        dr."directoryPath",
        dr.rating,
        dr.comparisons,
        dr."lastUpdated",
        dr."userId",
        dr."organizationId",
        dr.product,
        dr.version
      FROM "DirectoryRating" dr
      JOIN "UserOrganization" uo ON dr."userId" = uo."userId"
        AND uo."organizationId" = dr."organizationId"
        AND uo."isCurrentSession" = true
        AND uo."isApprovedMember" = true
      WHERE dr."organizationId" = ${activeOrg.organizationId}
      AND dr."comparisonSetId" IS NULL
      ORDER BY dr."lastUpdated" DESC
    `;

    // Calculate weighted averages for organization ratings
    const weightedRatings = orgRatings.reduce((acc, curr) => {
      const key = `${curr.product}:${curr.directoryPath}`;
      if (!acc[key]) {
        acc[key] = {
          totalWeightedRating: curr.rating * curr.comparisons,
          totalWeight: curr.comparisons,
          totalComparisons: curr.comparisons,
          lastUpdated: curr.lastUpdated,
          uniqueUsers: new Set([curr.userId]),
          organizationId: curr.organizationId,
          product: curr.product,
          version: curr.version,
          directoryPath: curr.directoryPath
        };
      } else {
        acc[key].totalWeightedRating += curr.rating * curr.comparisons;
        acc[key].totalWeight += curr.comparisons;
        acc[key].totalComparisons += curr.comparisons;
        acc[key].uniqueUsers.add(curr.userId);
        if (curr.lastUpdated > acc[key].lastUpdated) {
          acc[key].lastUpdated = curr.lastUpdated;
        }
      }
      return acc;
    }, {} as Record<string, {
      totalWeightedRating: number;
      totalWeight: number;
      totalComparisons: number;
      lastUpdated: Date;
      uniqueUsers: Set<string>;
      organizationId: string;
      product: string;
      version: string;
      directoryPath: string;
    }>);

    // Group organization ratings by product and version
    const groupedRatings = Object.values(weightedRatings).reduce((acc, rating) => {
      if (!acc[rating.product]) {
        acc[rating.product] = {};
      }
      if (!acc[rating.product][rating.version]) {
        acc[rating.product][rating.version] = [];
      }
      acc[rating.product][rating.version].push({
        directoryPath: rating.directoryPath,
        averageRating: rating.totalWeight > 0
          ? Math.round((rating.totalWeightedRating / rating.totalWeight) * 100) / 100
          : 0,
        totalRatings: rating.totalComparisons,
        totalUsers: rating.uniqueUsers.size,
        lastUpdated: rating.lastUpdated.toISOString()
      });
      return acc;
    }, {} as Record<string, Record<string, Array<{
      directoryPath: string;
      averageRating: number;
      totalRatings: number;
      totalUsers: number;
      lastUpdated: string;
    }>>>);

    // Convert to array format expected by frontend
    const organizationRatings = Object.entries(groupedRatings).map(([product, versions]) => ({
      product,
      versions: Object.fromEntries(
        Object.entries(versions).map(([version, directories]) => [
          version,
          directories.map(dir => ({
            ...dir,
            displayName: version
          }))
        ])
      )
    }));

    return NextResponse.json({
      personal: personalRatings.map(rating => ({
        directoryPath: rating.directoryPath,
        rating: rating.rating,
        totalComparisons: rating.comparisons,
        lastUpdated: rating.lastUpdated.toISOString(),
        product: rating.product,
        version: rating.version
      })),
      comparisonSets: formattedComparisonSetRatings,
      global: organizationRatings
    });
  } catch (error) {
    logger.error('GET /api/ratings failed', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please sign in' },
        { status: 401 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format',
          details: error instanceof Error ? error.message : 'Unknown parsing error',
        },
        { status: 400 },
      );
    }

    const { directoryPath, rating, comparisons, product, comparisonSetId } = body;

    if (!directoryPath || typeof rating !== 'number' || typeof comparisons !== 'number') {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: {
          directoryPath: !directoryPath ? 'Missing directory path' : undefined,
          rating: typeof rating !== 'number' ? 'Rating must be a number' : undefined,
          comparisons: typeof comparisons !== 'number' ? 'Comparisons must be a number' : undefined
        }
      }, { status: 400 });
    }

    const activeOrg = await getActiveOrganization(session.user.id);
    if (!activeOrg) {
      return NextResponse.json(
        { success: false, error: 'No active organization' },
        { status: 403 },
      );
    }

    // If comparisonSetId is provided, verify it exists and belongs to the organization
    if (comparisonSetId) {
      const comparisonSet = await prisma.comparisonSet.findUnique({
        where: { id: comparisonSetId }
      });

      if (!comparisonSet) {
        return NextResponse.json({
          success: false,
          error: 'Invalid comparison set',
          details: 'The specified comparison set does not exist'
        }, { status: 400 });
      }

      if (comparisonSet.organizationId !== activeOrg.organizationId) {
        return NextResponse.json({
          success: false,
          error: 'Invalid comparison set',
          details: 'The specified comparison set does not belong to your organization'
        }, { status: 403 });
      }
    }

    const normalizedPath = normalizeDirectoryPath(directoryPath);
    const pathParts = normalizedPath.split('/').filter(Boolean);
    const version = pathParts.length >= 3 ? pathParts.slice(2).join('/') : normalizedPath;
    const effectiveProduct = product || (pathParts.length >= 2 ? pathParts[1] : 'unknown');

    // Get existing rating if it exists - exact path matching with parameterized query
    const [existingRating] = await prisma.$queryRaw<Array<{
      id: string;
      rating: number;
      comparisons: number;
      lastUpdated: Date;
      directoryPath: string;
      product: string;
    }>>`
      SELECT *
      FROM "DirectoryRating"
      WHERE "userId" = ${session.user.id}::text
      AND "organizationId" = ${activeOrg.organizationId}::text
      AND "directoryPath" = ${normalizedPath}::text
      AND "product" = ${effectiveProduct}::text
      AND CASE
        WHEN ${comparisonSetId}::text IS NULL THEN "comparisonSetId" IS NULL
        ELSE "comparisonSetId" = ${comparisonSetId}::text
      END
      LIMIT 1
    `;

    let updatedRating;
    if (existingRating) {
      // Update existing rating with decay factor (blend old and new)
      const decayFactor = 0.5;
      const blendedRating = (existingRating.rating * (1 - decayFactor)) + (rating * decayFactor);

      const [updated] = await prisma.$queryRaw<Array<{
        id: string;
        directoryPath: string;
        rating: number;
        comparisons: number;
        lastUpdated: Date;
        product: string;
        version: string;
        comparisonSetId: string | null;
      }>>`
        UPDATE "DirectoryRating"
        SET
          rating = ${blendedRating}::float,
          comparisons = (${existingRating.comparisons} + ${comparisons})::integer,
          product = ${effectiveProduct}::text,
          version = ${version}::text,
          "lastUpdated" = NOW(),
          "comparisonSetId" = ${comparisonSetId || null}
        WHERE id = ${existingRating.id}::text
        RETURNING *
      `;
      updatedRating = updated;
    } else {
      const [newRating] = await prisma.$queryRaw<Array<{
        id: string;
        directoryPath: string;
        rating: number;
        comparisons: number;
        lastUpdated: Date;
        product: string;
        version: string;
        comparisonSetId: string | null;
      }>>`
        INSERT INTO "DirectoryRating" (
          id,
          "userId",
          "organizationId",
          "directoryPath",
          rating,
          comparisons,
          product,
          version,
          "comparisonSetId",
          "lastUpdated"
        )
        VALUES (
          gen_random_uuid(),
          ${session.user.id}::text,
          ${activeOrg.organizationId}::text,
          ${normalizedPath}::text,
          ${rating}::float,
          ${comparisons}::integer,
          ${effectiveProduct}::text,
          ${version}::text,
          ${comparisonSetId || null},
          NOW()
        )
        RETURNING *
      `;
      updatedRating = newRating;
    }

    if (!updatedRating) {
      throw new Error('Failed to update or create rating record');
    }

    return NextResponse.json({
      success: true,
      data: {
        directoryPath: updatedRating.directoryPath,
        rating: updatedRating.rating,
        totalComparisons: updatedRating.comparisons,
        lastUpdated: updatedRating.lastUpdated.toISOString(),
        comparisonSetId: updatedRating.comparisonSetId,
        product: updatedRating.product,
        version: updatedRating.version
      }
    });
  } catch (error) {
    logger.error('POST /api/ratings failed', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
