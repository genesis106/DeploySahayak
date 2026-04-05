import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, Shield, Heart, FileText, Brain } from "lucide-react";

const HeroSection = () => {
  // Environment-based URLs (safe fallback included)
  const victimUrl = import.meta.env.VITE_VICTIM_APP_URL || "#";
  const lawyerUrl = import.meta.env.VITE_LAWYER_APP_URL || "#";

  return (
    <section className="pt-28 pb-16 overflow-hidden">
      <div className="container grid lg:grid-cols-2 gap-12 items-center">
        
        {/* LEFT CONTENT */}
        <div className="space-y-8 animate-fade-in-up">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-light text-primary text-sm font-medium border border-primary/20">
            <Shield className="w-4 h-4" /> Voice-First Justice Platform
          </span>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight text-foreground">
            From fragmented memories to{" "}
            <span className="text-gradient font-display italic">
              court-ready evidence
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
            Sahayak transforms voice recordings of trauma survivors into structured legal testimony using Graph Intelligence and AI-powered analysis. Secure, private, and legally admissible.
          </p>

          {/* CTA BUTTONS */}
          <div className="flex flex-wrap gap-4">
            
            {/* Victim Button */}
            <Button variant="hero" size="lg" className="rounded-full px-8" asChild>
              <a
                href={`${victimUrl}/dashboard`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Go to victim dashboard"
              >
                <Heart className="w-4 h-4 mr-1" />
                I am a Victim
              </a>
            </Button>

            {/* Lawyer Button */}
            <Button variant="hero-outline" size="lg" className="rounded-full px-8" asChild>
              <a
                href={lawyerUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Go to lawyer portal"
              >
                <FileText className="w-4 h-4 mr-1" />
                I am a Lawyer
              </a>
            </Button>

          </div>
        </div>

        {/* RIGHT GRAPHIC */}
        <div className="relative hidden lg:flex items-center justify-center">
          <div className="relative w-80 h-80">
            
            {/* Center Circle */}
            <div className="absolute inset-1/4 rounded-full bg-primary flex items-center justify-center shadow-2xl animate-float">
              <Shield className="w-12 h-12 text-primary-foreground" />
            </div>

            {/* Orbit Icons */}
            {[
              { Icon: Mic, color: "bg-gold", top: "5%", left: "15%" },
              { Icon: Brain, color: "bg-primary-glow", top: "10%", right: "5%" },
              { Icon: Heart, color: "bg-rose", bottom: "15%", left: "5%" },
              { Icon: FileText, color: "bg-rose", bottom: "10%", right: "0%" },
            ].map(({ Icon, color, ...pos }, i) => (
              <div
                key={i}
                className={`absolute w-12 h-12 ${color} rounded-xl flex items-center justify-center shadow-lg animate-float`}
                style={{
                  ...pos,
                  animationDuration: `${3 + i * 0.5}s`,
                  animationDelay: `${i * 0.3}s`,
                }}
              >
                <Icon className="w-5 h-5 text-primary-foreground" />
              </div>
            ))}

            {/* Decorative Rings */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-border" />
            <div className="absolute inset-8 rounded-full border-2 border-dashed border-border/60" />
          </div>
        </div>

      </div>
    </section>
  );
};

export default HeroSection;