import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { RatingsDisplay } from '@/components/ratings/RatingsDisplay'

export default async function RatingsPage() {
  const session = await auth()
  
  if (!session?.user) {
    return (
      <div className="min-h-screen bg-white">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Card className="shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">Live Ratings</CardTitle>
              <CardDescription className="text-base">
                Please sign in to view live ratings for all image directories.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    )
  }

  // Get user's organization membership
  const userMembership = await prisma.$queryRaw<Array<{
    organizationId: string;
    organizationName: string;
    isApprovedMember: boolean;
  }>>`
    SELECT 
      uo."organizationId",
      o."name" as "organizationName",
      uo."isApprovedMember"
    FROM "UserOrganization" uo
    JOIN "Organization" o ON o."id" = uo."organizationId"
    WHERE uo."userId" = ${session.user.id}
    AND uo."isCurrentSession" = true
    LIMIT 1
  `

  // Check if user has an active membership
  if (!userMembership[0]?.organizationId || !userMembership[0]?.isApprovedMember) {
    return (
      <div className="min-h-screen bg-white">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Card className="shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">
                {!userMembership[0]?.organizationId ? (
                  "No Organization Selected"
                ) : !userMembership[0]?.isApprovedMember && (
                  "Pending Membership Approval"
                )}
              </CardTitle>
              <CardDescription className="text-base">
                {!userMembership[0]?.organizationId ? (
                  <p className="mt-2 text-sm text-yellow-700">
                    Please <a href="/dashboard/organization/join" className="font-medium underline">join an organization</a> to view live ratings.
                  </p>
                ) : !userMembership[0]?.isApprovedMember && (
                  <p className="mt-2 text-sm text-yellow-700">
                    Your organization membership is pending approval. Please wait for an admin to activate your account.
                  </p>
                )}
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    )
  }

  // Get personal ratings
  const personalRatings = await prisma.$queryRaw<Array<{
    directoryPath: string;
    rating: number;
    comparisons: number;
    lastUpdated: Date;
    product: string;
    version: string;
  }>>`
    SELECT 
      "directoryPath",
      rating,
      comparisons,
      "lastUpdated",
      product,
      version
    FROM "DirectoryRating"
    WHERE "userId" = ${session.user.id}
    AND "organizationId" = ${userMembership[0].organizationId}
    AND "comparisonSetId" IS NULL
    ORDER BY rating DESC, "lastUpdated" DESC
  `;

  // Get comparison set ratings
  const comparisonSetRatings = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    directoryPath: string;
    rating: string;
    comparisons: string;
    lastUpdated: Date;
    product: string;
    version: string;
    totalUsers: string;
    totalRatings: string;
    averageRating: string;
    isPersonal: boolean;
  }>>`
    WITH PersonalRatings AS (
      -- Get personal ratings
      SELECT 
        cs.id,
        cs.name,
        dr."directoryPath",
        dr.rating::text as rating,
        dr.comparisons::text as comparisons,
        dr."lastUpdated",
        dr.product,
        dr.version,
        '1'::text as "totalUsers",
        dr.comparisons::text as "totalRatings",
        dr.rating::text as "averageRating",
        true as "isPersonal"
      FROM "DirectoryRating" dr
      JOIN "ComparisonSet" cs ON cs.id = dr."comparisonSetId"
      WHERE dr."userId" = ${session.user.id}
      AND dr."organizationId" = ${userMembership[0].organizationId}
      AND dr."comparisonSetId" IS NOT NULL
    ),
    AggregatedRatings AS (
      -- Get aggregated ratings across all users
      SELECT 
        cs.id,
        cs.name,
        dr."directoryPath",
        CASE 
          WHEN SUM(dr.comparisons) > 0 
          THEN ROUND(SUM(dr.rating * dr.comparisons)::numeric / SUM(dr.comparisons), 1)::text
          ELSE '0'
        END as rating,
        SUM(dr.comparisons)::text as comparisons,
        MAX(dr."lastUpdated") as "lastUpdated",
        dr.product,
        dr.version,
        COUNT(DISTINCT dr."userId")::text as "totalUsers",
        SUM(dr.comparisons)::text as "totalRatings",
        CASE 
          WHEN SUM(dr.comparisons) > 0 
          THEN ROUND(SUM(dr.rating * dr.comparisons)::numeric / SUM(dr.comparisons), 1)::text
          ELSE '0'
        END as "averageRating",
        false as "isPersonal"
      FROM "DirectoryRating" dr
      JOIN "ComparisonSet" cs ON cs.id = dr."comparisonSetId"
      JOIN "UserOrganization" uo ON dr."userId" = uo."userId"
        AND uo."organizationId" = dr."organizationId"
        AND uo."isApprovedMember" = true
      WHERE dr."organizationId" = ${userMembership[0].organizationId}
      AND dr."comparisonSetId" IS NOT NULL
      GROUP BY cs.id, cs.name, dr."directoryPath", dr.product, dr.version
    ),
    CombinedRatings AS (
      -- Combine both personal and aggregated ratings
      SELECT * FROM PersonalRatings
      UNION ALL
      SELECT * FROM AggregatedRatings
    )
    -- Apply ordering on the combined results
    SELECT *
    FROM CombinedRatings
    ORDER BY 
      "isPersonal" DESC,
      rating::numeric DESC,
      name,
      "lastUpdated" DESC
  `;

  // Group comparison set ratings by set and type (personal/aggregated)
  const comparisonSets = comparisonSetRatings.reduce((acc, rating) => {
    const type = rating.isPersonal ? 'personal' : 'aggregated';
    if (!acc[type]) {
      acc[type] = {};
    }
    if (!acc[type][rating.id]) {
      acc[type][rating.id] = {
        id: rating.id,
        name: rating.name,
        ratings: []
      };
    }
    acc[type][rating.id].ratings.push({
      directoryPath: rating.directoryPath,
      rating: parseFloat(rating.rating),
      comparisons: parseInt(rating.comparisons),
      lastUpdated: rating.lastUpdated.toISOString(),
      product: rating.product,
      version: rating.version,
      totalUsers: parseInt(rating.totalUsers),
      totalRatings: parseInt(rating.totalRatings)
    });
    return acc;
  }, {} as Record<'personal' | 'aggregated', Record<string, { id: string; name: string; ratings: any[] }>>);

  // Transform into the expected format
  const transformedComparisonSets = {
    personal: Object.values(comparisonSets.personal || {}),
    aggregated: Object.values(comparisonSets.aggregated || {})
  };

  // Get organization ratings
  const orgRatings = await prisma.$queryRaw<Array<{
    directoryPath: string;
    product: string;
    version: string;
    totalRatings: string;
    averageRating: string;
    totalUsers: string;
    lastUpdated: Date;
  }>>/* sql */`
    WITH RatingStats AS (
      SELECT 
        dr."directoryPath",
        dr.product,
        dr.version,
        COUNT(DISTINCT dr."userId") as "totalUsers",
        SUM(dr.comparisons) as "totalRatings",
        CASE 
          WHEN SUM(dr.comparisons) > 0 
          THEN ROUND(SUM(dr.rating * dr.comparisons)::numeric / SUM(dr.comparisons), 1)
          ELSE 0 
        END as "averageRating",
        MAX(dr."lastUpdated") as "lastUpdated"
      FROM "DirectoryRating" dr
      JOIN "UserOrganization" uo ON dr."userId" = uo."userId"
        AND uo."organizationId" = dr."organizationId"
        AND uo."isApprovedMember" = true
      WHERE dr."organizationId" = ${userMembership[0].organizationId}
      AND dr."comparisonSetId" IS NULL
      GROUP BY dr."directoryPath", dr.product, dr.version
    )
    SELECT 
      "directoryPath",
      product,
      version,
      "totalUsers"::text,
      "totalRatings"::text,
      "averageRating"::text,
      "lastUpdated"
    FROM RatingStats
    ORDER BY "averageRating"::numeric DESC, product, version, "directoryPath"
  `;

  // Transform organization ratings into the expected format
  const organizationRatings = orgRatings.reduce((acc, rating) => {
    const product = rating.product || 'unknown';
    const version = rating.version || 'unknown';

    if (!acc[product]) {
      acc[product] = {
        product,
        versions: {}
      };
    }

    if (!acc[product].versions[version]) {
      acc[product].versions[version] = [];
    }

    acc[product].versions[version].push({
      directoryPath: rating.directoryPath,
      totalRatings: parseInt(rating.totalRatings),
      averageRating: parseFloat(rating.averageRating),
      totalUsers: parseInt(rating.totalUsers),
      lastUpdated: rating.lastUpdated.toISOString(),
      displayName: version
    });

    return acc;
  }, {} as Record<string, { product: string; versions: Record<string, any[]> }>);

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Live Ratings</CardTitle>
            <CardDescription className="text-base">
              View and analyze ratings for all image directories in {userMembership[0].organizationName}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RatingsDisplay 
              personalRatings={personalRatings.map(r => ({
                ...r,
                lastUpdated: r.lastUpdated.toISOString()
              }))}
              organizationRatings={Object.values(organizationRatings)}
              comparisonSets={transformedComparisonSets}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 