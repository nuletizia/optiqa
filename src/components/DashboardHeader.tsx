"use client"

import { signIn } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "./ui/button"
import { useSession } from "next-auth/react"
import { UserNav } from "./user-nav"
import { useEffect, useState, useRef } from "react"

export function DashboardHeader() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [orgName, setOrgName] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState(Date.now())
  const [orgMenuOpen, setOrgMenuOpen] = useState(false)
  const orgMenuRef = useRef<HTMLDivElement>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)

  useEffect(() => {
    const fetchOrgData = async () => {
      if (session?.user?.organizationId) {
        const response = await fetch('/api/user/memberships', {
          // Add cache busting to force a fresh fetch
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        })
        const memberships = await response.json()
        const activeOrg = memberships.find((m: any) => m.isCurrentSession)
        if (activeOrg) {
          setOrgName(activeOrg.organizationName)
          setIsAdmin(activeOrg.isAdmin === true)
        }
      } else {
        setOrgName(null)
        setIsAdmin(false)
      }
    }

    fetchOrgData()

    // Set up polling to check for organization changes
    const interval = setInterval(() => {
      setLastFetch(Date.now())
    }, 2000) // Check every 2 seconds

    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (orgMenuRef.current && !orgMenuRef.current.contains(event.target as Node)) {
        setOrgMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    
    return () => {
      clearInterval(interval)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [session, lastFetch])

  const handleSignIn = async () => {
    await signIn("google", { callbackUrl: "/dashboard" })
  }

  const toggleOrgMenu = () => {
    setOrgMenuOpen(!orgMenuOpen)
  }

  return (
    <header className="bg-gray-50 shadow-md border-b">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href={session ? "/dashboard" : "/"} className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="OptiQA Logo" 
                className="h-8 w-8"
              />
              <span className="text-xl font-bold">OptiQA</span>
            </Link>
            <div className="flex items-center gap-4">
              {/* Anonymous-only entry to the public comparison engine. Signed-in
                  users reach it from the dashboard (grade cards + ad-hoc link). */}
              {!session && (
                <Link
                  href="/comparison"
                  className={`text-sm ${
                    pathname === "/comparison"
                      ? "text-[#00B4D8] font-medium"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Compare
                </Link>
              )}
              {session && (
                <>
                  <Link
                    href="/dashboard/new-comparison"
                    className={`text-sm ${
                      pathname === "/dashboard/new-comparison"
                        ? "text-[#00B4D8] font-medium"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Create comparison
                  </Link>
                  <Link
                    href="/dashboard/comparisons"
                    className={`text-sm ${
                      pathname === "/dashboard/comparisons"
                        ? "text-[#00B4D8] font-medium"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    History
                  </Link>
                  <Link
                    href="/dashboard/ratings"
                    className={`text-sm ${
                      pathname === "/dashboard/ratings"
                        ? "text-[#00B4D8] font-medium"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Live Ratings
                  </Link>
                </>
              )}
            </div>
          </div>
          {session ? (
            <div className="flex items-center gap-4">
              {session?.user?.organizationId ? (
                <div className="relative" ref={orgMenuRef}>
                  <button 
                    onClick={toggleOrgMenu}
                    className={`text-sm flex items-center gap-1 ${
                      pathname.startsWith("/dashboard/organization")
                        ? "text-[#00B4D8] font-medium"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Organization {orgName ? `(${orgName})` : ''}
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className={`ml-1 transition-transform ${orgMenuOpen ? 'rotate-180' : ''}`}
                    >
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </button>
                  {orgMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                      <div className="py-1">
                        <Link
                          href="/dashboard/organization"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                          onClick={() => setOrgMenuOpen(false)}
                        >
                          Overview
                        </Link>
                        {isAdmin && (
                          <Link
                            href="/dashboard/manage-organization"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                            onClick={() => setOrgMenuOpen(false)}
                          >
                            Manage Organization
                          </Link>
                        )}
                        <Link
                          href="/dashboard/switch-organization"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                          onClick={() => setOrgMenuOpen(false)}
                        >
                          Switch Organization
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative" ref={orgMenuRef}>
                  <button 
                    onClick={toggleOrgMenu}
                    className={`text-sm flex items-center gap-1 ${
                      pathname.startsWith("/dashboard/organization")
                        ? "text-[#00B4D8] font-medium"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Organization
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className={`ml-1 transition-transform ${orgMenuOpen ? 'rotate-180' : ''}`}
                    >
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </button>
                  {orgMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                      <div className="py-1">
                        <Link
                          href="/dashboard/organization/join"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                          onClick={() => setOrgMenuOpen(false)}
                        >
                          Join Organization
                        </Link>
                        <Link
                          href="/dashboard/organization/create"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                          onClick={() => setOrgMenuOpen(false)}
                        >
                          Create Organization
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <UserNav user={session.user} />
            </div>
          ) : (
            <Button
              variant="default"
              onClick={handleSignIn}
              className="bg-[#006A93] text-white hover:bg-[#00B4D8]"
            >
              Sign In
            </Button>
          )}
        </div>
      </nav>
    </header>
  )
} 