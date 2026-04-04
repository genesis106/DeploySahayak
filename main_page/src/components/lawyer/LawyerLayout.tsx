import { NavLink, Outlet } from "react-router-dom";
import { Shield, LayoutDashboard, Brain, FileText, LogOut } from "lucide-react";
import { Link } from "react-router-dom";

const navItems = [
  { to: "/lawyer/testimony", icon: LayoutDashboard, label: "Testimonies" },
  { to: "/lawyer/ai-query", icon: Brain, label: "AI Query" },
  { to: "/lawyer/documents", icon: FileText, label: "Documents" },
];

const LawyerLayout = () => (
  <div className="flex min-h-screen bg-background">
    {/* Sidebar */}
    <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shrink-0">
      <Link to="/" className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center">
          <Shield className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        <span className="font-display font-bold text-lg">Sahayak</span>
      </Link>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Link to="/" className="flex items-center gap-3 px-7 py-4 text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors border-t border-sidebar-border">
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
