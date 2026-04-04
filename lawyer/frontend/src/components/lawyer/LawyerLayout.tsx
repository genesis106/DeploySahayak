import { NavLink, Outlet } from "react-router-dom";
import { Shield, LayoutDashboard, Brain, FileText, LogOut } from "lucide-react";
import { Link } from "react-router-dom";

const navItems = [
  { to: "/testimony", icon: LayoutDashboard, label: "Testimonies" },
  { to: "/ai-query", icon: Brain, label: "AI Query" },
  { to: "/documents", icon: FileText, label: "Documents" },
];

const LawyerLayout = () => (
  <div className="flex min-h-screen bg-background">
    {/* Premium Sidebar */}
    <aside className="w-64 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 border-r border-slate-800/60 flex flex-col shrink-0 shadow-2xl relative overflow-hidden">
      {/* Decorative Blur */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <Link to="/" className="relative z-10 flex items-center gap-3 px-6 py-6 border-b border-white/5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Shield className="w-5 h-5 text-emerald-50" />
        </div>
        <span className="font-display font-bold text-xl tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">Sahayak</span>
      </Link>
      
      <nav className="relative z-10 flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group relative flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden ${isActive ? "text-emerald-300 bg-emerald-400/10 shadow-[inset_0_1px_rgba(255,255,255,0.05)] border border-emerald-500/20" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1/2 bg-gradient-to-b from-emerald-300 to-emerald-500 rounded-r-full shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
                )}
                <item.icon className={`w-5 h-5 transition-transform duration-400 ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
                <span className="relative z-10">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Link to="/" className="relative z-10 flex items-center gap-3 px-6 py-5 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors border-t border-white/5 bg-slate-900/50 hover:bg-slate-800/50">
        <LogOut className="w-4 h-4" /> Exit Dashboard
      </Link>
    </aside>

    {/* Main */}
    <main className="flex-1 flex flex-col">
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8">
        <h2 className="text-lg font-semibold text-foreground">Lawyer Dashboard</h2>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">A</div>
          <span className="text-sm font-medium text-foreground">Adv. Sharma</span>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-8">
        <Outlet />
      </div>
    </main>
  </div>
);

export default LawyerLayout;
