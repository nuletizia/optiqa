import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveOrganization } from '@/lib/auth/organization';
import { listCommonPrefixes, listObjects, isImageKey } from '@/lib/s3';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - Please sign in'
      }, { status: 401 });
    }

    // Get user's active organization
    const activeOrg = await getActiveOrganization(session.user.id);
    if (!activeOrg) {
      return NextResponse.json({
        success: false,
        error: 'No active organization'
      }, { status: 403 });
    }

    const organizationPath = activeOrg.organizationName.toLowerCase();
    const productName = name;

    // List all versions/folders in the product
    const versionPrefixes = await listCommonPrefixes(`${organizationPath}/${productName}/`);

    if (versionPrefixes.length === 0) {
      return NextResponse.json({
        success: true,
        versions: []
      });
    }

    // Get files from all versions
    const versions = await Promise.all(
      versionPrefixes.map(async (prefix) => {
        const versionName = prefix.split('/').filter(Boolean).pop() || '';

        const contents = await listObjects(prefix);

        // Filter for image files and extract just the filenames
        const files = contents
          .filter(obj => isImageKey(obj.Key))
          .map(obj => obj.Key!.split('/').pop()!)
          .filter(Boolean);

        if (files.length > 0) {
          // Extract pattern from first file
          const pattern = files[0].replace(/\d+/, '*');

          return {
            name: versionName,
            path: prefix,
            files,
            pattern,
            fileCount: files.length
          };
        }
        return null;
      })
    );

    // Filter out null values and sort by version name
    const validVersions = versions
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      versions: validVersions
    });

  } catch (error) {
    logger.error('GET /api/organization/products/[name]/files failed', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}
