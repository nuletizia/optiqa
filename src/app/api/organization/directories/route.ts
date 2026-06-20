import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveOrganization } from '@/lib/auth/organization';
import { listVersionDirectories } from '@/lib/directories';
import { logger } from '@/lib/logger';

/**
 * Flat list of every version directory (with at least one image) in the active
 * organization. Backs the directory pickers in the UI so the browser never needs
 * S3 credentials.
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

    const directories = await listVersionDirectories(activeOrg.organizationName);
    return NextResponse.json({ success: true, directories });
  } catch (error) {
    logger.error('GET /api/organization/directories failed', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
