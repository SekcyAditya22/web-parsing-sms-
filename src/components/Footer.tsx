import type React from "react"

const Footer: React.FC = () => {
  return (
    <footer className="bg-gradient-to-r from-slate-900 to-purple-900 text-white relative overflow-hidden dark:from-slate-950 dark:to-slate-900">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/10 to-purple-600/10 animate-pulse"></div>
      </div>

      <div className="relative z-10">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Uji Coba Kingg
            </h3>
            <p className="text-sm text-white/60 mt-2">© {new Date().getFullYear()} Aditya.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
