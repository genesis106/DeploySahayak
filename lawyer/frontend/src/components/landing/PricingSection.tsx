import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Star, Zap, Crown, Briefcase, Building2, Rocket } from "lucide-react";

const victimPlans = [
  {
    name: "Free", price: "₹0", period: "", icon: Zap, badge: null,
    features: ["3 cases", "10 testimonies per case", "Basic cognitive map", "100 MB storage"],
    cta: "Get Started", highlighted: false,
  },
  {
    name: "Plus", price: "₹99", period: "/month", icon: Star, badge: "Best Value",
    features: ["Unlimited testimonies", "AI clustering", "Timeline generation", "Conflict detection"],
    cta: "Upgrade", highlighted: true,
  },
  {
    name: "Premium", price: "₹299", period: "/month", icon: Crown, badge: null,
    features: ["Legal document generation", "Lawyer connect", "Priority AI processing", "Evidence packaging"],
    cta: "Go Premium", highlighted: false,
  },
];

const lawyerPlans = [
  {
    name: "Starter", price: "₹499", period: "/month", icon: Briefcase, badge: null,
    features: ["10 clients", "Basic AI query", "20 documents/month", "Email support"],
    cta: "Get Started", highlighted: false,
  },
  {
    name: "Pro", price: "₹1,499", period: "/month", icon: Rocket, badge: "Most Popular",
    features: ["Unlimited clients", "Advanced AI insights", "300 AI queries/month", "100 documents/month"],
    cta: "Start Pro", highlighted: true,
  },
  {
    name: "Enterprise", price: "₹4,999", period: "/month", icon: Building2, badge: null,
    features: ["Unlimited everything", "Multi-lawyer collaboration", "Analytics dashboard", "API access"],
    cta: "Contact Sales", highlighted: false,
  },
];

const PricingSection = () => {
  const [tab, setTab] = useState<"victim" | "lawyer">("victim");
  const plans = tab === "victim" ? victimPlans : lawyerPlans;

  return (
    <section id="pricing" className="py-20 bg-muted/30">
      <div className="container">
        <div className="text-center mb-10">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">Pricing</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold mt-3 text-foreground">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Accessible for victims. Powerful for legal professionals.</p>

          <div className="inline-flex mt-8 rounded-full bg-muted p-1 border border-border">
            <button onClick={() => setTab("victim")} className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${tab === "victim" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              For Victims
            </button>
            <button onClick={() => setTab("lawyer")} className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${tab === "lawyer" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              For Lawyers
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div key={plan.name} className={`relative bg-card rounded-2xl p-8 border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${plan.highlighted ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-border hover:border-primary/20"}`}>
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full shadow-md">
                  {plan.badge}
                </span>
              )}
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${plan.highlighted ? "bg-primary text-primary-foreground" : "bg-primary-light text-primary"}`}>
                  <plan.icon className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground text-sm">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant={plan.highlighted ? "hero" : "outline"} className="w-full rounded-full">
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10 max-w-2xl mx-auto">
          🧠 AI-powered features use controlled retrieval and validation pipelines to ensure accuracy and reduce hallucinations.
        </p>
      </div>
    </section>
  );
};

export default PricingSection;
