import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Session } from 'next-auth';

interface DirectoryRating {
  directoryPath: string;
  product: string;
  version: string;
  totalRatings: number;
  averageRating: number;
  totalUsers: number;
}

interface ProductVersion {
  directoryPath: string;
  totalRatings: number;
  averageRating: number;
  totalUsers: number;
}

interface Product {
  product: string;
  versions: {
    [key: string]: ProductVersion[];
  };
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get user's current organization
    const currentOrg = await prisma.$queryRaw<Array<{ organizationId: string }>>`
      SELECT "organizationId"
      FROM "UserOrganization"
      WHERE "userId" = ${(session as Session & { user: { id: string } }).user.id}
      AND "isCurrentSession" = true
      AND "isApprovedMember" = true
      LIMIT 1
    `;

    if (!currentOrg[0]) {
      return new NextResponse('No current organization found', { status: 404 });
    }

    // Get all directories with ratings for the organization
    const directories = await prisma.$queryRaw<DirectoryRating[]>`
      SELECT 
        "directoryPath",
        "product",
        "version",
        COUNT(*) as "totalRatings",
        AVG(rating) as "averageRating",
        COUNT(DISTINCT "userId") as "totalUsers"
      FROM "DirectoryRating"
      WHERE "organizationId" = ${currentOrg[0].organizationId}
      AND "comparisonSetId" IS NULL
      GROUP BY "directoryPath", "product", "version"
      ORDER BY "product", "version", "directoryPath"
    `;

    // Transform the data into the expected format
    const products = directories.reduce<Product[]>((acc, dir) => {
      const product = acc.find(p => p.product === dir.product);
      if (!product) {
        acc.push({
          product: dir.product,
          versions: {
            [dir.version]: [{
              directoryPath: dir.directoryPath,
              totalRatings: Number(dir.totalRatings),
              averageRating: Number(dir.averageRating),
              totalUsers: Number(dir.totalUsers)
            }]
          }
        });
      } else {
        if (!product.versions[dir.version]) {
          product.versions[dir.version] = [];
        }
        product.versions[dir.version].push({
          directoryPath: dir.directoryPath,
          totalRatings: Number(dir.totalRatings),
          averageRating: Number(dir.averageRating),
          totalUsers: Number(dir.totalUsers)
        });
      }
      return acc;
    }, []);

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error in ratings/directories API:', error);
    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Server Error',
      { status: 500 }
    );
  }
} 