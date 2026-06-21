import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveOrganization } from '@/lib/auth/organization';
import { getPresignedUploadUrl } from '@/lib/s3';
import { logger } from '@/lib/logger';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// `path` is either:
//   - a legacy `product/version` prefix (back-compat), or
//   - a job prefix `jobs/{jobId}/a|b` used by the current upload wizard.
// `fileName` must be a bare basename (no separators, no traversal) so the final
// S3 key cannot escape the organization prefix.
const PATH_PATTERN = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/;
const JOB_PATH_PATTERN = /^jobs\/[a-zA-Z0-9-]+\/[ab]$/;
const FILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please sign in' },
        { status: 401 },
      );
    }

    // Any approved member of the active org may upload images
    // (getActiveOrganization already requires isApprovedMember = true).
    const activeOrg = await getActiveOrganization(session.user.id);
    if (!activeOrg) {
      return NextResponse.json(
        { success: false, error: 'No active organization' },
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

    const pathAllowed = PATH_PATTERN.test(path) || JOB_PATH_PATTERN.test(path);
    if (!pathAllowed || !FILE_NAME_PATTERN.test(fileName) || fileName.includes('..')) {
      return NextResponse.json(
        { success: false, error: 'Invalid upload path or file name' },
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
