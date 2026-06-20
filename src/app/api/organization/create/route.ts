import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    // Check if organization with this name already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { name: name.trim() }
    });

    if (existingOrg) {
      return NextResponse.json({ error: "An organization with this name already exists" }, { status: 409 });
    }

    // Deactivate any existing active organizations for this user
    await prisma.userOrganization.updateMany({
      where: {
        userId: session.user.id,
        isCurrentSession: true
      },
      data: {
        isCurrentSession: false,
        updatedAt: new Date()
      }
    });

    // Create the organization
    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
        updatedAt: new Date()
      }
    });

    // Create the user-organization relationship with admin privileges and update user status
    const [userOrganization] = await prisma.$transaction([
      prisma.userOrganization.create({
        data: {
          userId: session.user.id,
          organizationId: organization.id,
          isCurrentSession: true, // Make this the current session
          isApprovedMember: true, // Auto-approve for creator
          isAdmin: true,  // Auto-admin for creator
          joinedAt: new Date(),
          updatedAt: new Date()
        }
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { isActive: true }
      })
    ]);

    // Generate an initial invite code for the organization
    const inviteCode = await prisma.organizationInviteCode.create({
      data: {
        code: `ORG-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        organizationId: organization.id,
        createdById: session.user.id
      }
    });

    return NextResponse.json({
      success: true,
      organization,
      userOrganization,
      inviteCode
    });
  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
} 