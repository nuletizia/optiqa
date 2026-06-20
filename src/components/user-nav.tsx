import { signOut } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { useEffect, useState } from "react"

export function UserNav({ user }: { user: any }) {
  const [isAdmin, setIsAdmin] = useState<boolean>(false)

  useEffect(() => {
    const checkAdminStatus = async () => {
      setIsAdmin(false) // Reset to false by default
      
      if (user?.organizationId) {
        try {
          const response = await fetch('/api/user/memberships')
          if (response.ok) {
            const memberships = await response.json()
            // Find the active membership (isCurrentSession is true)
            const activeMembership = memberships.find((m: any) => m.isCurrentSession)
            // Only set to true if explicitly true
            setIsAdmin(activeMembership?.isAdmin === true)
          }
        } catch (error) {
          console.error('Error checking admin status:', error)
        }
      }
    }

    checkAdminStatus()
  }, [user?.organizationId])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image} alt={user.name} />
            <AvatarFallback>{user.name?.[0]}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/profile">Profile</Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={async (event) => {
            event.preventDefault()
            await signOut({ 
              callbackUrl: "/auth/signin"
            })
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 