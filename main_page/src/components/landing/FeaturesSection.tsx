import { Mic, Brain, Shield, BarChart3 } from "lucide-react";

const features = [
  { icon: Mic, title: "Voice Testimony", desc: "Record trauma narratives in any Indian language. AI transcribes, structures, and preserves emotional context for legal proceedings." },
  { icon: Brain, title: "Cognitive Map", desc: "Graph-based visualization of people, places, events, and connections. Automatically detects contradictions and patterns." },
  { icon: Shield, title: "Secure Evidence", desc: "End-to-end AES-256 encryption. Tamper-proof evidence packaging with digital signatures and chain-of-custody tracking." },
  { icon: BarChart3, title: "AI Insights", desc: "Advanced NLP identifies key suspects, timelines, and corroborating evidence. Generates court-ready summaries and documents." },
];

const FeaturesSection = () => (
  <section id="features" className="py-20">
    <div className="container">
      <div className="text-center mb-14">
        <span className="text-sm font-semibold text-primary uppercase tracking-wider">Capabilities</span>
        <h2 className="text-3xl md:text-4xl font-display font-bold mt-3 text-foreground">Powerful Tools for Justice</h2>
        <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">Everything you need to transform survivor narratives into legally admissible evidence.</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((f) => (
          <div key={f.title} className="group bg-card rounded-xl p-6 border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300">
            <div className="w-12 h-12 rounded-lg bg-primary-light flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <f.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection;
