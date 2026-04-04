import { Shield } from "lucide-react";

const Footer = () => (
  <footer className="py-12 border-t border-border bg-muted/30">
    <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        <span className="font-display font-bold text-foreground">Sahayak</span>
      </div>
      <p className="text-sm text-muted-foreground">© 2026 Sahayak. Built for justice. Powered by AI.</p>
    </div>
  </footer>
);

export default Footer;
