import { Shield, Mic, GitBranch, FileText, Lock, ArrowRight, Heart, Globe, Zap, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useReveal } from "@/hooks/use-reveal";
import Navbar from "@/components/Navbar";

const features = [
  {
    icon: Mic,
    title: "Speak, Don't Type",
    description: "Record memories in your own language — Hindi, Marathi, or any Indian dialect. Zero literacy required.",
    color: "bg-sage-light text-primary",
  },
  {
    icon: GitBranch,
    title: "Adaptive Testimony Graph",
    description: "Fragments are mapped into an intelligent graph — people, places, times — all connected automatically.",
    color: "bg-gold-light text-accent",
  },
  {
    icon: FileText,
    title: "One-Click Legal Drafts",
    description: "Generate FIR drafts, affidavits, and Section 164 statements powered by Claw LegalTech.",
    color: "bg-sky-soft text-graph-location",
  },
  {
    icon: Lock,
    title: "Safety by Design",
    description: "Quick-exit button, AES-256 encryption, and Incognito-friendly. Built for the most vulnerable.",
    color: "bg-rose-soft text-graph-evidence",
  },
];

const steps = [
  { num: "01", title: "Capture", desc: "Record a voice note in your language" },
  { num: "02", title: "Process", desc: "AI transcribes and extracts entities" },
  { num: "03", title: "Map", desc: "Fragments become graph nodes" },
  { num: "04", title: "Draft", desc: "Court-ready documents in one click" },
];

const stats = [
  { value: "12+", label: "Indian Languages" },
  { value: "< 3min", label: "To First Draft" },
  { value: "AES-256", label: "Encryption" },
  { value: "Zero", label: "Downloads Needed" },
];

export default function LandingPage() {
  const revealRef = useReveal();

  return (
    <div ref={revealRef} className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="reveal">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sage-light text-primary text-sm font-medium mb-6">
                <Shield className="w-4 h-4" />
                Voice-First Justice Platform
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display leading-[1.08] tracking-tight mb-6">
                From fragmented
                <br />
                memories to
                <br />
                <span className="text-gradient">court-ready evidence</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
                Sahayak transforms voice recordings of trauma survivors into structured legal testimony using Graph Intelligence and Claw LegalTech. voice recordings of trauma survivors into structured legal testimony using Graph Intelligence and Claw LegalTech.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/cognitive-map">
                  <Button variant="hero" size="xl">
                    <Mic className="w-5 h-5" />
                    Start Recording
                  </Button>
                </Link>
                <Link to="/dashboard">
                  <Button variant="hero-outline" size="xl">
                    View Demo
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Hero visual — graph illustration */}
            <div className="reveal hidden lg:flex justify-center" style={{ transitionDelay: "150ms" }}>
              <div className="relative w-[420px] h-[420px]">
                {/* Central node */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-primary flex items-center justify-center shadow-xl glow-sage z-10">
                  <Shield className="w-10 h-10 text-primary-foreground" />
                </div>
                {/* Orbiting nodes */}
                {[
                  { icon: Mic, x: "15%", y: "20%", color: "bg-accent", delay: "animate-float" },
                  { icon: GitBranch, x: "75%", y: "15%", color: "bg-graph-location", delay: "animate-float-delay" },
                  { icon: FileText, x: "80%", y: "70%", color: "bg-graph-evidence", delay: "animate-float-delay-2" },
                  { icon: Heart, x: "10%", y: "75%", color: "bg-primary", delay: "animate-float-delay" },
                ].map((node, i) => (
                  <div key={i}>
                    {/* Edge line */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                      <line
                        x1="50%" y1="50%"
                        x2={node.x} y2={node.y}
                        stroke="hsl(var(--graph-edge))"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                        opacity="0.5"
                      />
                    </svg>
                    <div
                      className={`absolute w-14 h-14 rounded-2xl ${node.color} flex items-center justify-center shadow-lg ${node.delay} z-10`}
                      style={{ left: node.x, top: node.y, transform: "translate(-50%, -50%)" }}
                    >
                      <node.icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                  </div>
                ))}
                {/* Decorative rings */}
                <div className="absolute inset-8 rounded-full border border-border/40" />
                <div className="absolute inset-16 rounded-full border border-border/30" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-12 px-6 border-y border-border/50 bg-card/50">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 reveal">
            {stats.map((stat, i) => (
              <div key={i} className="text-center" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="text-2xl sm:text-3xl font-display text-primary mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 reveal">
            <h2 className="text-3xl sm:text-4xl font-display mb-4">Built for the most vulnerable</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Every feature is designed with trauma-informed principles, accessibility, and safety at its core.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="reveal group p-8 rounded-2xl bg-card border border-border/50 hover:border-border transition-all duration-300 hover:shadow-lg"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-5`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-display mb-2">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-card/50 border-y border-border/50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16 reveal">
            <h2 className="text-3xl sm:text-4xl font-display mb-4">From trauma to testimony</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Four steps. Minutes, not weeks.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="reveal relative p-6 rounded-2xl bg-background border border-border/50" style={{ transitionDelay: `${i * 120}ms` }}>
                <span className="text-5xl font-display text-border/80 absolute top-4 right-5">{step.num}</span>
                <div className="pt-10">
                  <h3 className="text-lg font-semibold mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 z-10" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-3xl text-center reveal">
          <div className="p-12 rounded-3xl bg-primary text-primary-foreground">
            <Scale className="w-10 h-10 mx-auto mb-5 opacity-80" />
            <h2 className="text-3xl sm:text-4xl font-display mb-4">Every voice deserves justice</h2>
            <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto text-lg leading-relaxed">
              Start recording your testimony today. No downloads, no sign-ups, no barriers.
            </p>
            <Link to="/cognitive-map">
              <Button variant="gold" size="xl" className="text-foreground">
                <Mic className="w-5 h-5" />
                Begin Your Testimony
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border/50">
        <div className="container mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-display text-lg">Sahayak</span>
            <span className="text-muted-foreground text-sm ml-2">× Claw LegalTech</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Globe className="w-4 h-4" /> Web-First</span>
            <span className="flex items-center gap-1"><Lock className="w-4 h-4" /> AES-256</span>
            <span className="flex items-center gap-1"><Zap className="w-4 h-4" /> Powered by Claw</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
