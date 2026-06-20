import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getActiveOrganization } from "@/lib/auth/organization"
import { logger } from "@/lib/logger"

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's active organization
    const activeOrg = await getActiveOrganization(session.user.id);
    if (!activeOrg) {
      return NextResponse.json({ error: "No active organization" }, { status: 403 });
    }

    // Verify user is an admin
    if (!activeOrg.isAdmin) {
      return NextResponse.json({ error: "Only admins can reset comparison sets" }, { status: 403 });
    }

    // Delete all comparison sets for the organization
    await prisma.comparisonSet.deleteMany({
      where: {
        organizationId: activeOrg.organizationId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("POST /api/organization/comparison-sets/reset failed", error);
    return NextResponse.json(
      { error: "Failed to reset comparison sets" },
      { status: 500 }
    );
  }
}
