import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveOrganization } from '@/lib/auth/organization';
import { getPresignedUploadUrl } from '@/lib/s3';
import { logger } from '@/lib/logger';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

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
        { success: false, error: 'Only organization admins can upload files' },
        { status: 403 },
      );
    }

    const { fileName, contentType, path } = await request.json();
    if (!fileName || !contentType || !path) {
      return NextResponse.json(
        { success: false, error: 'Please provide fileName, contentType, and path' },
        { status: 400 },
      );
    }

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Only ${ALLOWED_CONTENT_TYPES.join(', ')} files are allowed`,
        },
        { status: 400 },
      );
    }

    const organizationPath = activeOrg.organizationName.toLowerCase();
    const s3Key = `${organizationPath}/${path}/${fileName}`;
    const url = await getPresignedUploadUrl(s3Key, contentType);

    return NextResponse.json({ success: true, url });
  } catch (error) {
    logger.error('POST /api/organization/upload/presigned failed', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
