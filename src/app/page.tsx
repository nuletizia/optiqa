import { Button } from "@/components/ui/button"
import { auth } from "@/auth"
import Link from "next/link"

export default async function Home() {
  const session = await auth()
  
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="pt-32 pb-16 text-center px-4">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight max-w-4xl mx-auto">
          The simplest way to assess
          <span className="bg-gradient-to-r from-[#006A93] to-[#00B4D8] bg-clip-text text-transparent"> image quality</span>
        </h1>
        <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
          Compare product versions, validate improvements, and make data-driven decisions without the cost of building in-house tools and hiring external evaluators.
        </p>
        <div className="mt-10">
          {!session ? (
            <>
              <Link href="/auth/signin">
                <Button className="h-12 px-8 text-lg bg-[#006A93] text-white hover:bg-[#00B4D8]">
                  Get Started
                </Button>
              </Link>
              <p className="mt-3 text-sm text-gray-500">No signup required</p>
            </>
          ) : (
            <Link href="/dashboard">
              <Button className="h-12 px-8 text-lg bg-[#006A93] text-white hover:bg-[#00B4D8]">
                Go to Dashboard
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Product Showcase */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Mac-style window controls */}
          <div className="flex items-center gap-2 px-4 py-3 bg-[#00B4D8]/10 border-b border-[#00B4D8]/20">
            <div className="h-3 w-3 rounded-full bg-red-500"></div>
            <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
          </div>
          <div className="p-8 text-center">
            <h2 className="text-2xl font-semibold mb-4">Powerful Image Comparison</h2>
            <p className="text-gray-600 mb-8">
              Upload, compare, and analyze image quality with our intuitive interface
            </p>
            <div className="aspect-video bg-white rounded-lg overflow-hidden">
              <img 
                src="/product-image.jpg" 
                alt="OptiQA product interface" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200">
            <h3 className="text-lg font-semibold mb-2">Easy Comparison</h3>
            <p className="text-gray-600">Compare different versions of your products with a simple and intuitive interface.</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200">
            <h3 className="text-lg font-semibold mb-2">Team Collaboration</h3>
            <p className="text-gray-600">Work together with your team to assess and improve image quality.</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200">
            <h3 className="text-lg font-semibold mb-2">Data-Driven Decisions</h3>
            <p className="text-gray-600">Make informed decisions based on quantitative and qualitative feedback.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-50 border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center text-gray-600 text-sm">
            © {new Date().getFullYear()} OptiQA. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}