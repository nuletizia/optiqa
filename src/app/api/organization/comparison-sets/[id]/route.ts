import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getActiveOrganization } from "@/lib/auth/organization"
import { logger } from "@/lib/logger"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
      return NextResponse.json({ error: "Only admins can update comparison sets" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Verify the comparison set exists and belongs to the organization
    const existingSet = await prisma.comparisonSet.findUnique({
      where: { id: id }
    });

    if (!existingSet) {
      return NextResponse.json(
        { error: "Comparison set not found" },
        { status: 404 }
      );
    }

    if (existingSet.organizationId !== activeOrg.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized to update this comparison set" },
        { status: 403 }
      );
    }

    // Update the comparison set
    const updatedSet = await prisma.comparisonSet.update({
      where: { id: id },
      data: {
        name,
        description
      }
    });

    return NextResponse.json(updatedSet);
  } catch (error) {
    logger.error("PATCH /api/organization/comparison-sets/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to update comparison set" },
      { status: 500 }
    );
  }
}
