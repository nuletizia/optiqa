import NextAuth, { DefaultSession } from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import type { JWT } from "next-auth/jwt"

// Extend the built-in types
declare module "next-auth" {
  interface User {
    isApprovedMember?: boolean
    organizationId?: string | null
  }
  
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      organizationId: string | null;
      isApprovedMember: boolean;
      isCurrentSession: boolean;
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    isApprovedMember: boolean
    organizationId: string | null
  }
}

export const { handlers: { GET, POST }, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  debug: false,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Create or update user in database
        const dbUser = await prisma.user.upsert({
          where: { email: user.email || token.email! },
          create: {
            email: user.email || token.email!,
            name: user.name || token.name,
            image: user.image || token.picture,
          },
          update: {
            name: user.name || token.name,
            image: user.image || token.picture,
          }
        })

        // Get user's active organization membership
        const activeOrgs = await prisma.$queryRaw<Array<{ 
          organizationId: string, 
          isApprovedMember: boolean,
          isCurrentSession: boolean 
        }>>`
          SELECT "organizationId", "isApprovedMember", "isCurrentSession"
          FROM "UserOrganization"
          WHERE "userId" = ${dbUser.id}
          AND "isCurrentSession" = true
          AND "isApprovedMember" = true
          LIMIT 1
        `

        const activeOrg = activeOrgs[0]
        token.id = dbUser.id
        token.isApprovedMember = activeOrg?.isApprovedMember || false
        token.isCurrentSession = activeOrg?.isCurrentSession || false
        token.organizationId = activeOrg?.organizationId || null

        // Update user's isActive status if they have an active organization
        if (activeOrg?.isApprovedMember) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { isActive: true }
          })
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;

        // Get the user's active organization from the database
        const activeOrgs = await prisma.$queryRaw<Array<{
          organizationId: string;
          isApprovedMember: boolean;
          isCurrentSession: boolean;
        }>>`
          SELECT 
            uo."organizationId",
            uo."isApprovedMember",
            uo."isCurrentSession"
          FROM "UserOrganization" uo
          WHERE uo."userId" = ${token.id}
          AND uo."isCurrentSession" = true
          AND uo."isApprovedMember" = true
          LIMIT 1
        `;

        const activeOrg = activeOrgs[0];
        // Update session with latest organization info
        session.user.organizationId = activeOrg?.organizationId;
        session.user.isApprovedMember = activeOrg?.isApprovedMember ?? false;
        session.user.isCurrentSession = activeOrg?.isCurrentSession ?? false;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allow relative URLs
      if (url.startsWith("/")) {
        return url
      }
      // Allow URLs on the same origin
      if (url.startsWith(baseUrl)) {
        return url
      }
      // Default to the dashboard
      return "/dashboard"
    },
  },
}) 