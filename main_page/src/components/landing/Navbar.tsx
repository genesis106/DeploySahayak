import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

const Navbar = () => (
  <nav className="fixed top-0 w-full z-50 glass">
    <div className="container flex items-center justify-between h-16">
      <Link to="/" className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-display font-bold text-foreground">Sahayak</span>
      </Link>
      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
        <a href="#features" className="hover:text-primary transition-colors">Features</a>
        <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
        <a href="#security" className="hover:text-primary transition-colors">Security</a>
        <a href="http://localhost:8082/" className="text-primary font-semibold hover:text-primary-glow transition-colors">Lawyer Portal</a>
      </div>
    </div>
  </nav>
);

export default Navbar;
