import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveOrganization } from '@/lib/auth/organization';
import { listDirectoryImages } from '@/lib/directories';
import { logger } from '@/lib/logger';

/**
 * Images in a single directory, as presigned URLs the browser can load directly.
 *
 * Query params:
 *   path    - the directory prefix (must belong to the active organization)
 *   product - the product the directory belongs to (echoed back on each image)
 */
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    const product = searchParams.get('product') ?? '';

    if (!path) {
      return NextResponse.json(
        { success: false, error: 'Missing required "path" query parameter' },
        { status: 400 },
      );
    }

    // Confine access to the caller's organization prefix.
    const organizationPrefix = `${activeOrg.organizationName.toLowerCase()}/`;
    if (!path.startsWith(organizationPrefix)) {
      return NextResponse.json(
        { success: false, error: 'Directory does not belong to your organization' },
        { status: 403 },
      );
    }

    const files = await listDirectoryImages(path, product);
    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: `No images found in directory ${path}` },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, files });
  } catch (error) {
    logger.error('GET /api/organization/directories/files failed', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
