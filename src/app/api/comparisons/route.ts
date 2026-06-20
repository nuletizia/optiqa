import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const comparisons = await prisma.comparisonResult.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(comparisons.map(comparison => ({
      id: comparison.id,
      createdAt: comparison.createdAt,
      directoryV1: comparison.directoryV1,
      directoryV2: comparison.directoryV2,
      scoreV1: comparison.scoreV1,
      scoreV2: comparison.scoreV2,
      totalComparisons: comparison.totalComparisons,
      detailedResults: comparison.detailedResults
    })))
  } catch (error) {
    console.error("Error fetching comparisons:", error)
    return NextResponse.json(
      { error: "Failed to fetch comparisons" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { directoryV1, directoryV2, scoreV1, scoreV2, totalComparisons, detailedResults } = body

    // Validate required fields
    if (!directoryV1 || !directoryV2 || typeof scoreV1 !== 'number' || typeof scoreV2 !== 'number' || !totalComparisons) {
      return NextResponse.json(
        { 
          error: "Missing required fields",
          received: {
            directoryV1,
            directoryV2,
            scoreV1,
            scoreV2,
            totalComparisons,
            hasDetailedResults: !!detailedResults
          }
        },
        { status: 400 }
      )
    }

    const comparison = await prisma.comparisonResult.create({
      data: {
        userId: session.user.id,
        directoryV1,
        directoryV2,
        scoreV1,
        scoreV2,
        totalComparisons,
        detailedResults: detailedResults || null
      }
    })

    return NextResponse.json({
      id: comparison.id,
      createdAt: comparison.createdAt,
      directoryV1: comparison.directoryV1,
      directoryV2: comparison.directoryV2,
      scoreV1: comparison.scoreV1,
      scoreV2: comparison.scoreV2,
      totalComparisons: comparison.totalComparisons,
      detailedResults: comparison.detailedResults
    })
  } catch (error) {
    console.error("Error saving comparison:", error)
    return NextResponse.json(
      { error: "Failed to save comparison" },
      { status: 500 }
    )
  }
} 