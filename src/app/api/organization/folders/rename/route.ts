import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveOrganization } from '@/lib/auth/organization';
import { s3Client, S3_BUCKET, listObjects } from '@/lib/s3';
import { logger } from '@/lib/logger';
import { CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

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
        { success: false, error: 'Only organization admins can rename folders' },
        { status: 403 },
      );
    }

    const { oldPath, newName } = await request.json();
    if (!oldPath || !newName) {
      return NextResponse.json(
        { success: false, error: 'Please provide both oldPath and newName' },
        { status: 400 },
      );
    }

    // Normalize paths
    const normalizedOldPath = oldPath.replace(/\/*$/, '');
    const pathSegments = normalizedOldPath.split('/');
    const oldFolderName = pathSegments[pathSegments.length - 1];
    const parentPath = pathSegments.slice(0, -1).join('/');
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;
    const product = pathSegments.length > 1 ? pathSegments[1] : null;

    const operationId = `rename_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // List all objects in the old folder
    const contents = await listObjects(normalizedOldPath);
    if (contents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No objects found in source folder' },
        { status: 400 },
      );
    }

    const totalObjects = contents.length;

    // Create initial operation record
    await prisma.$executeRaw`
      INSERT INTO "RenameOperation" (
        "id",
        "organizationId",
        "status",
        "progress",
        "oldPath",
        "newPath",
        "startTime",
        "totalObjects",
        "processedObjects"
      ) VALUES (
        ${operationId},
        ${activeOrg.organizationId},
        'started',
        0,
        ${normalizedOldPath},
        ${newPath},
        NOW(),
        ${totalObjects},
        0
      )
    `;

    // Start the S3 operations in the background
    (async () => {
      try {
        for (const [index, object] of contents.entries()) {
          if (!object.Key) continue;

          try {
            const newKey = object.Key.replace(normalizedOldPath, newPath);

            await s3Client.send(
              new CopyObjectCommand({
                Bucket: S3_BUCKET,
                CopySource: `${S3_BUCKET}/${object.Key}`,
                Key: newKey,
              }),
            );

            await s3Client.send(
              new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: object.Key }),
            );

            await prisma.$executeRaw`
              UPDATE "RenameOperation"
              SET
                "progress" = ${((index + 1) / totalObjects) * 100},
                "processedObjects" = ${index + 1},
                "updatedAt" = NOW(),
                "status" = 'in_progress'
              WHERE "id" = ${operationId}
            `;
          } catch (err) {
            logger.error(`Rename: error processing object ${object.Key}`, err);
            await prisma.$executeRaw`
              UPDATE "RenameOperation"
              SET
                "status" = 'error',
                "error" = ${err instanceof Error ? err.message : 'Unknown error processing object'},
                "updatedAt" = NOW()
              WHERE "id" = ${operationId}
            `;
            return;
          }
        }

        // Update the exact-match directory ratings
        await prisma.$executeRaw`
          UPDATE "DirectoryRating"
          SET
            "directoryPath" = ${newPath},
            "version" = ${newName},
            "lastUpdated" = NOW()
          WHERE "organizationId" = ${activeOrg.organizationId}
          AND product = ${product}
          AND (
            "directoryPath" = ${normalizedOldPath}
            OR "directoryPath" = ${normalizedOldPath + '/'}
          )
        `;

        // Update nested directory ratings
        await prisma.$executeRaw`
          UPDATE "DirectoryRating"
          SET
            "directoryPath" = ${newPath} || substring("directoryPath" from length(${normalizedOldPath}) + 1),
            "version" = CASE
              WHEN "version" = ${oldFolderName} THEN ${newName}
              ELSE "version"
            END,
            "lastUpdated" = NOW()
          WHERE "organizationId" = ${activeOrg.organizationId}
          AND product = ${product}
          AND (
            "directoryPath" LIKE ${normalizedOldPath + '/%'}
          )
        `;

        // Update comparison sets that referenced the old path
        await prisma.$executeRaw`
          WITH updated_paths AS (
            SELECT
              id,
              CASE
                WHEN "directoryV1" = ${normalizedOldPath} OR "directoryV1" = ${normalizedOldPath + '/'} THEN ${newPath}
                WHEN "directoryV1" LIKE ${normalizedOldPath + '/%'} THEN ${newPath} || substring("directoryV1" from length(${normalizedOldPath}) + 1)
                ELSE "directoryV1"
              END as new_v1,
              CASE
                WHEN "directoryV2" = ${normalizedOldPath} OR "directoryV2" = ${normalizedOldPath + '/'} THEN ${newPath}
                WHEN "directoryV2" LIKE ${normalizedOldPath + '/%'} THEN ${newPath} || substring("directoryV2" from length(${normalizedOldPath}) + 1)
                ELSE "directoryV2"
              END as new_v2
            FROM "ComparisonSet"
            WHERE "organizationId" = ${activeOrg.organizationId}
          )
          UPDATE "ComparisonSet" cs
          SET
            "directoryV1" = up.new_v1,
            "directoryV2" = up.new_v2
          FROM updated_paths up
          WHERE cs.id = up.id
        `;

        await prisma.$executeRaw`
          UPDATE "RenameOperation"
          SET
            "status" = 'completed',
            "progress" = 100,
            "endTime" = NOW(),
            "updatedAt" = NOW()
          WHERE "id" = ${operationId}
        `;
      } catch (err) {
        logger.error('Rename: error in background processing', err);
        await prisma.$executeRaw`
          UPDATE "RenameOperation"
          SET
            "status" = 'error',
            "error" = ${err instanceof Error ? err.message : 'Unknown error in background processing'},
            "updatedAt" = NOW()
          WHERE "id" = ${operationId}
        `;
      }
    })();

    return NextResponse.json({
      success: true,
      message: 'Rename operation started successfully',
      operationId,
      details: { oldPath: normalizedOldPath, newPath },
    });
  } catch (error) {
    logger.error('POST /api/organization/folders/rename failed', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// Check the status of a background rename operation
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please sign in' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const operationId = searchParams.get('operationId');
    if (!operationId) {
      return NextResponse.json(
        { success: false, error: 'Missing operation ID' },
        { status: 400 },
      );
    }

    const [status] = await prisma.$queryRaw<
      Array<{
        status: string;
        progress: number;
        processedObjects: number | null;
        totalObjects: number | null;
        error: string | null;
        oldPath: string;
        newPath: string;
        startTime: Date;
        endTime: Date | null;
      }>
    >`
      SELECT
        status,
        progress,
        "processedObjects",
        "totalObjects",
        error,
        "oldPath",
        "newPath",
        "startTime",
        "endTime"
      FROM "RenameOperation"
      WHERE id = ${operationId}
      LIMIT 1
    `;

    return NextResponse.json({ success: true, status });
  } catch (error) {
    logger.error('GET /api/organization/folders/rename failed', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
