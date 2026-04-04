import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useReveal } from "@/hooks/use-reveal";
import { Button } from "@/components/ui/button";
import { Shield, Eye, EyeOff, ArrowRight, Heart, Lock, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const revealRef = useReveal();
  const navigate = useNavigate();
  const { login, register } = useAuth();
  
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(formData.phone, formData.password);
        toast.success("Successfully logged in");
      } else {
        await register(formData.phone, formData.password, formData.name);
        toast.success("Account created successfully");
      }
      window.location.href = "/dashboard";
    } catch (err: any) {
      toast.error(err.message || "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={revealRef} className="min-h-screen bg-background flex items-center justify-center px-4 py-8">

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="reveal text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl tracking-tight">Sahayak</span>
          </Link>
          <p className="text-muted-foreground text-sm mt-3">
            Your safe space. Your words matter.
          </p>
        </div>

        {/* Card */}
        <div className="reveal rounded-2xl bg-card border border-border/50 p-6 sm:p-8 shadow-sm" style={{ transitionDelay: "100ms" }}>
          {/* Tab Toggle */}
          <div className="flex rounded-lg bg-muted p-1 mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${
                mode === "login" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${
                mode === "signup" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Your Name (optional)</label>
                <input
                  type="text"
                  placeholder="Any name you feel safe using"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground mt-1">You can use a pseudonym for safety.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="tel"
                  placeholder="+91 XXXXX XXXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a secure password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full h-11 pl-10 pr-11 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : (mode === "login" ? "Sign In Securely" : "Create Safe Account")}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>
        </div>

        {/* Trust Signals */}
        <div className="reveal mt-6 space-y-3" style={{ transitionDelay: "200ms" }}>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-sage-light border border-primary/10">
            <Lock className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">End-to-End Encrypted</p>
              <p className="text-xs text-muted-foreground">Your data is encrypted before it leaves your device.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gold-light border border-accent/10">
            <Heart className="w-5 h-5 text-accent shrink-0" />
            <div>
              <p className="text-sm font-medium">Trauma-Informed Design</p>
              <p className="text-xs text-muted-foreground">Built with care. You can exit safely at any time.</p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          If you are in immediate danger, call <strong className="text-foreground">Women Helpline: 181</strong>
        </p>
      </div>
    </div>
  );
}
