import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ComparisonSet } from "@prisma/client"
import { Session } from 'next-auth'

// Define interface for enhanced comparison set with creator info
interface EnhancedComparisonSet extends ComparisonSet {
  createdBy: {
    name: string | null;
    email: string;
  };
}

// Helper function to get current organization
async function getCurrentOrganization(userId: string) {
  const [currentOrg] = await prisma.$queryRaw<Array<{
    organizationId: string;
    isCurrentSession: boolean;
    isAdmin: boolean;
  }>>`
    SELECT 
      "organizationId",
      "isCurrentSession",
      "isAdmin"
    FROM "UserOrganization"
    WHERE "userId" = ${userId}
    AND "isCurrentSession" = true
    LIMIT 1
  `;
  
  return currentOrg || null;
}

// GET endpoint to fetch comparison sets for the organization
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's current organization
    const currentOrg = await getCurrentOrganization((session as Session & { user: { id: string } }).user.id);
    
    if (!currentOrg) {
      // If no current organization, return all comparison sets created by the user
      const userComparisonSets = await prisma.comparisonSet.findMany({
        where: {
          createdById: (session as Session & { user: { id: string } }).user.id
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      // Fetch user information separately for each comparison set
      const enhancedSets = await Promise.all(
        userComparisonSets.map(async (set) => {
          const creator = await prisma.user.findUnique({
            where: { id: set.createdById },
            select: { name: true, email: true }
          });
          
          return {
            ...set,
            createdBy: {
              name: creator?.name ?? null,
              email: creator?.email ?? 'unknown'
            }
          };
        })
      );
      
      return NextResponse.json(enhancedSets);
    }

    // Fetch comparison sets for the organization
    const comparisonSets = await prisma.comparisonSet.findMany({
      where: {
        organizationId: currentOrg.organizationId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Fetch user information separately for each comparison set
    const enhancedSets = await Promise.all(
      comparisonSets.map(async (set) => {
        const creator = await prisma.user.findUnique({
          where: { id: set.createdById },
          select: { name: true, email: true }
        });
        
        return {
          ...set,
          createdBy: {
            name: creator?.name ?? null,
            email: creator?.email ?? 'unknown'
          }
        };
      })
    );

    return NextResponse.json(enhancedSets);
  } catch (error) {
    console.error("Error fetching comparison sets:", error);
    return NextResponse.json(
      { error: "Failed to fetch comparison sets" },
      { status: 500 }
    );
  }
}

// POST endpoint to create a new comparison set
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's current organization
    const currentOrg = await getCurrentOrganization((session as Session & { user: { id: string } }).user.id);
    
    if (!currentOrg) {
      return NextResponse.json({ error: "No current organization" }, { status: 403 });
    }

    // Verify user is an admin
    if (!currentOrg.isAdmin) {
      return NextResponse.json({ error: "Only admins can create comparison sets" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, directoryV1, directoryV2 } = body;

    // Validate required fields
    if (!name || !directoryV1 || !directoryV2) {
      return NextResponse.json(
        { error: "Missing required fields", details: { name, directoryV1, directoryV2 } },
        { status: 400 }
      );
    }

    // Create comparison set
    const comparisonSet = await prisma.comparisonSet.create({
      data: {
        name,
        description,
        directoryV1,
        directoryV2,
        organizationId: currentOrg.organizationId,
        createdById: (session as Session & { user: { id: string } }).user.id
      }
    });
    
    // Fetch creator information
    const creator = await prisma.user.findUnique({
      where: { id: (session as Session & { user: { id: string } }).user.id },
      select: { name: true, email: true }
    });
    
    return NextResponse.json({
      ...comparisonSet,
      createdBy: {
        name: creator?.name ?? null,
        email: creator?.email ?? 'unknown'
      }
    });
  } catch (error) {
    console.error("Error creating comparison set:", error);
    return NextResponse.json(
      { error: "Failed to create comparison set" },
      { status: 500 }
    );
  }
}

// DELETE endpoint to delete a comparison set
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's current organization
    const currentOrg = await getCurrentOrganization((session as Session & { user: { id: string } }).user.id);
    if (!currentOrg) {
      return NextResponse.json({ error: "No current organization" }, { status: 403 });
    }

    // Verify user is an admin
    if (!currentOrg.isAdmin) {
      return NextResponse.json({ error: "Only admins can delete comparison sets" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: "Missing comparison set ID" },
        { status: 400 }
      );
    }

    // Verify the comparison set belongs to the organization
    const comparisonSet = await prisma.comparisonSet.findUnique({
      where: { id }
    });

    if (!comparisonSet) {
      return NextResponse.json(
        { error: "Comparison set not found" },
        { status: 404 }
      );
    }

    if (comparisonSet.organizationId !== currentOrg.organizationId) {
      return NextResponse.json(
        { error: "Comparison set does not belong to your organization" },
        { status: 403 }
      );
    }

    // Delete the comparison set
    await prisma.comparisonSet.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting comparison set:", error);
    return NextResponse.json(
      { error: "Failed to delete comparison set" },
      { status: 500 }
    );
  }
} 