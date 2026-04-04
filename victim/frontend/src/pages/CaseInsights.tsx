// src/pages/CaseInsights.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "@/components/Navbar";
import { useCaseContext } from "@/contexts/CaseContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, CheckCircle2, Loader2, ShieldAlert, Scale,
  BookOpen, AlertTriangle, Play, Sparkles, Gavel, Search,
  ChevronRight, ArrowRight, Zap, Eye, FileText, Shield, Clock, BarChart3,
} from "lucide-react";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const outcomeConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  conviction:  { label: "Conviction",  color: "text-rose-600",    bg: "bg-rose-50 border-rose-200",    icon: "⚖️" },
  acquittal:   { label: "Acquittal",   color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: "✅" },
  settlement:  { label: "Settlement",  color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",  icon: "🤝" },
};

// Markdown bold parser
const formatBoldText = (text: any) => {
  if (typeof text !== "string" || !text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="text-primary font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return (
      <span key={index}>
        {part.split("\n").map((line, i, arr) => (
          <span key={i}>
            {line}
            {i !== arr.length - 1 && <br />}
          </span>
        ))}
      </span>
    );
  });
};

// Animated counter for stats
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const duration = 1200;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}{suffix}</>;
}

export default function CaseInsights() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { activeCaseId, activeCaseName } = useCaseContext();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);

  const [cases, setCases] = useState<any[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [selectedCase, setSelectedCase] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<{
    detailedAnalysis: string;
    gaps: any[];
    sections: any[];
  }>({ detailedAnalysis: "", gaps: [], sections: [] });

  // ── Reveal animation ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        });
      },
      { threshold: 0.05 }
    );

    const observeAll = () => {
      const children = el.querySelectorAll(".reveal:not(.revealed)");
      children.forEach((child) => observer.observe(child));
    };

    observeAll();

    const mutationObserver = new MutationObserver(() => observeAll());
    mutationObserver.observe(el, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [hasAnalyzed, isAnalyzing, isLoadingSaved]);

  // ── Auto-load saved data ──────────────────────────────────────────────────
  const fetchSavedData = useCallback(async () => {
    if (!activeCaseId) { setIsLoadingSaved(false); return; }
    setIsLoadingSaved(true);
    try {
      const [casesRes, analysisRes] = await Promise.all([
        fetch(`${API_BASE_URL}/cases/${activeCaseId}/legal/related-cases`),
        fetch(`${API_BASE_URL}/cases/${activeCaseId}/legal/full-analysis`),
      ]);

      if (casesRes.ok) {
        const casesData = await casesRes.json();
        const safeCases = Array.isArray(casesData?.cases) ? casesData.cases : [];
        setCases(safeCases);
        setSummary(casesData?.overall_match_summary || "");
        if (safeCases.length > 0) setSelectedCase(safeCases[0].id);
      }

      if (analysisRes.ok) {
        const analysisData = await analysisRes.json();
        if (analysisData && analysisData.bns_mapping) {
          setAnalysis({
            detailedAnalysis: typeof analysisData.bns_mapping?.detailed_analysis === "string" ? analysisData.bns_mapping.detailed_analysis : "",
            gaps: Array.isArray(analysisData.gap_analysis?.gaps) ? analysisData.gap_analysis.gaps.filter((g: any) => g.status === "missing") : [],
            sections: Array.isArray(analysisData.bns_mapping?.bns_sections) ? analysisData.bns_mapping.bns_sections : [],
          });
          setHasAnalyzed(true);
        } else {
          setHasAnalyzed(false);
        }
      } else if (analysisRes.status === 404) {
        setHasAnalyzed(false);
      }
    } catch (err) {
      console.error("Failed to load saved insights:", err);
    } finally {
      setIsLoadingSaved(false);
    }
  }, [activeCaseId]);

  useEffect(() => { fetchSavedData(); }, [fetchSavedData]);

  // ── Run analysis ──────────────────────────────────────────────────────────
  const runComprehensiveAnalysis = async () => {
    if (!activeCaseId) return;
    if (!activeCaseName) {
      toast.error("Please select a case before running analysis.");
      return;
    }
    setIsAnalyzing(true);
    setAnalyzeProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setAnalyzeProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 8;
      });
    }, 500);

    const doAnalysis = async () => {
      const [casesRes, fullAnalysisRes] = await Promise.all([
        fetch(`${API_BASE_URL}/cases/${activeCaseId}/legal/related-cases?force_refresh=true`),
        fetch(`${API_BASE_URL}/cases/${activeCaseId}/legal/full-analysis`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ case_name: activeCaseName, draft_type: "FIR" }),
        }),
      ]);

      if (!fullAnalysisRes.ok) {
        let errorMessage = "Failed to run analysis";
        try {
          const errorData = await fullAnalysisRes.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = `Analysis failed (${fullAnalysisRes.status}: ${fullAnalysisRes.statusText})`;
        }
        throw new Error(errorMessage);
      }

      let casesData: any = { cases: [], overall_match_summary: "" };
      if (casesRes.ok) {
        try { casesData = await casesRes.json(); } catch { /* safe */ }
      }

      const analysisData = await fullAnalysisRes.json();
      const safeCases = Array.isArray(casesData?.cases) ? casesData.cases : [];
      setCases(safeCases);
      setSummary(casesData?.overall_match_summary || "");
      if (safeCases.length > 0) setSelectedCase(safeCases[0].id);

      setAnalysis({
        detailedAnalysis: typeof analysisData.bns_mapping?.detailed_analysis === "string" ? analysisData.bns_mapping.detailed_analysis : "",
        gaps: Array.isArray(analysisData.gap_analysis?.gaps) ? analysisData.gap_analysis.gaps.filter((g: any) => g.status === "missing") : [],
        sections: Array.isArray(analysisData.bns_mapping?.bns_sections) ? analysisData.bns_mapping.bns_sections : [],
      });
      setAnalyzeProgress(100);
      setHasAnalyzed(true);
    };

    toast.promise(
      doAnalysis().finally(() => {
        clearInterval(progressInterval);
        setIsAnalyzing(false);
        setAnalyzeProgress(0);
      }),
      {
        loading: "Running AI-powered legal analysis...",
        success: "Case analysis completed successfully!",
        error: (err) => `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      }
    );
  };

  const activeCase = cases.find((c) => c.id === selectedCase);
  const caseStrength = analysis.sections.length > 0 ? Math.min(100, Math.round((analysis.sections.length / (analysis.sections.length + analysis.gaps.length || 1)) * 100)) : 0;

  return (
    <div ref={containerRef} className="min-h-screen bg-background relative overflow-hidden">
      <Navbar />

      {/* ── Ambient Background Decoration ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-3xl animate-pulse-soft" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-gold/[0.04] blur-3xl animate-pulse-soft" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-sage/[0.02] blur-3xl" />
      </div>

      <div className="pt-20 px-4 sm:px-6 pb-16 relative">
        <div className="container mx-auto max-w-7xl">

          {/* ═══════════════════════════════════════════════════════════════════
              HERO HEADER
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="reveal mb-10">
            <div className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card/80 to-gold/[0.04] p-8 md:p-10 shadow-lg">
              {/* Decorative grid */}
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }} />

              <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI-Powered Legal Intelligence
                  </div>
                  <h1 className="text-4xl md:text-5xl font-display text-foreground leading-tight">
                    Case <span className="text-gradient">Insights</span>
                  </h1>
                  <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
                    Deep legal analysis powered by AI — mapping your testimony to BNS 2023 sections,
                    detecting evidence gaps, and discovering matching court precedents.
                  </p>
                </div>

                <Button
                  onClick={runComprehensiveAnalysis}
                  disabled={isAnalyzing || !activeCaseId}
                  variant="hero"
                  size="xl"
                  className="shadow-xl hover:shadow-2xl group relative overflow-hidden shrink-0"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  {isAnalyzing ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                  )}
                  {isAnalyzing ? "Analyzing..." : hasAnalyzed ? "Re-analyze Case" : "Run Full Analysis"}
                </Button>
              </div>

              {/* Analysis progress bar during run */}
              {isAnalyzing && (
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-xs font-medium text-muted-foreground">
                    <span>Processing with Claw LegalGPT & Gemini AI</span>
                    <span>{Math.round(analyzeProgress)}%</span>
                  </div>
                  <Progress value={analyzeProgress} className="h-2" />
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              STATES: Loading / Empty / Analyzing / Results
          ═══════════════════════════════════════════════════════════════════ */}
          {isLoadingSaved ? (
            <div className="reveal flex flex-col items-center justify-center py-24">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
                <div className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              </div>
              <h2 className="text-xl font-display mt-6 mb-2">Loading Saved Insights</h2>
              <p className="text-sm text-muted-foreground">Checking for previously generated analysis...</p>
            </div>

          ) : !hasAnalyzed && !isAnalyzing ? (
            <div className="reveal">
              <div className="max-w-2xl mx-auto text-center py-20">
                <div className="relative mx-auto w-24 h-24 mb-8">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-gold/20 rotate-6 animate-pulse-soft" />
                  <div className="relative w-24 h-24 rounded-3xl bg-card border border-border/50 flex items-center justify-center shadow-lg">
                    <Scale className="w-10 h-10 text-primary/40" />
                  </div>
                </div>
                <h2 className="text-2xl md:text-3xl font-display mb-3">No Analysis Yet</h2>
                <p className="text-muted-foreground max-w-md mx-auto leading-relaxed mb-8">
                  Click <strong className="text-foreground">"Run Full Analysis"</strong> to map your testimony
                  to BNS 2023, detect critical legal gaps, and find matching court precedents.
                </p>
                <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                  {[
                    { icon: BookOpen, label: "BNS Mapping", desc: "Section identification" },
                    { icon: AlertTriangle, label: "Gap Detection", desc: "Missing elements" },
                    { icon: Search, label: "Precedent Search", desc: "Court judgments" },
                  ].map(({ icon: Icon, label, desc }, i) => (
                    <div key={i} className="p-4 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/20 transition-all duration-300 group cursor-default">
                      <Icon className="w-6 h-6 text-primary/60 mx-auto mb-2 group-hover:text-primary group-hover:scale-110 transition-all" />
                      <div className="text-xs font-bold text-foreground/80">{label}</div>
                      <div className="text-[10px] text-muted-foreground">{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          ) : isAnalyzing ? (
            <div className="reveal">
              <div className="max-w-xl mx-auto text-center py-16">
                <div className="relative mx-auto w-28 h-28 mb-8">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" style={{ animationDuration: "3s" }} />
                  <div className="absolute inset-2 rounded-full border-2 border-gold/20 border-b-gold animate-spin" style={{ animationDuration: "2s", animationDirection: "reverse" }} />
                  <div className="absolute inset-4 rounded-full bg-primary/5 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                  </div>
                </div>
                <h2 className="text-2xl font-display mb-2">Synthesizing Legal Intelligence</h2>
                <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                  Running BNS mapping, gap detection, and searching live court records.
                </p>
                <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                  {["BNS 2023 Mapping", "Gap Analysis", "Precedent Search"].map((step, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 0.5}s` }} />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          ) : (
            /* ═══════════════════════════════════════════════════════════════
               RESULTS VIEW — The main attraction
            ═══════════════════════════════════════════════════════════════ */
            <div className="space-y-8">

              {/* ── Quick Stats Row ── */}
              <div className="reveal grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: BookOpen, label: "BNS Sections", value: analysis.sections.length, color: "text-primary", bgColor: "bg-primary/10", borderColor: "border-primary/15" },
                  { icon: AlertTriangle, label: "Legal Gaps", value: analysis.gaps.length, color: "text-destructive", bgColor: "bg-destructive/10", borderColor: "border-destructive/15" },
                  { icon: Gavel, label: "Precedents", value: cases.length, color: "text-accent", bgColor: "bg-accent/10", borderColor: "border-accent/15" },
                  { icon: BarChart3, label: "Case Strength", value: caseStrength, color: "text-primary", bgColor: "bg-primary/10", borderColor: "border-primary/15", suffix: "%" },
                ].map(({ icon: Icon, label, value, color, bgColor, borderColor, suffix }, i) => (
                  <div
                    key={i}
                    className={`group relative p-5 rounded-2xl border ${borderColor} bg-card/70 backdrop-blur-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 overflow-hidden`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center mb-3`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <div className={`text-3xl font-display ${color}`}>
                      <AnimatedNumber value={value} suffix={suffix} />
                    </div>
                    <div className="text-sm text-muted-foreground font-medium">{label}</div>
                  </div>
                ))}
              </div>

              {/* ── AI Strategy Summary ── */}
              <div className="reveal">
                <div className="relative overflow-hidden rounded-[1.5rem] border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-sage-light/30 shadow-md">
                  {/* Subtle corner accent */}
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-gold/10 to-transparent rounded-bl-full" />
                  
                  <div className="relative p-6 md:p-8">
                    <div className="flex items-start gap-4 mb-5">
                      <div className="p-3 bg-gradient-to-br from-primary to-sage-dark rounded-2xl text-primary-foreground shadow-md shrink-0">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="text-xl font-display text-foreground">AI Legal Strategy</h2>
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
                            <Sparkles className="w-3 h-3 mr-1" /> AI Generated
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          {summary || "No strategy summary available."}
                        </p>
                      </div>
                    </div>

                    {analysis.detailedAnalysis && (
                      <div className="mt-6 pt-6 border-t border-primary/10">
                        <div className="flex items-center gap-2 mb-4">
                          <Eye className="w-4 h-4 text-muted-foreground" />
                          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                            Detailed Testimony Breakdown
                          </h3>
                        </div>
                        <div className="text-sm text-foreground/85 leading-relaxed space-y-3 bg-background/60 backdrop-blur-sm p-6 rounded-2xl border border-primary/10 shadow-inner">
                          {formatBoldText(analysis.detailedAnalysis)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── BNS Sections & Gaps – Side by Side ── */}
              <div className="grid md:grid-cols-2 gap-6">

                {/* BNS Sections */}
                <div className="reveal group">
                  <div className="h-full rounded-[1.5rem] border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                    <div className="p-5 border-b border-border/30 bg-gradient-to-r from-primary/[0.05] to-transparent">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-display flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-primary" />
                          </div>
                          Mapped BNS Sections
                        </h2>
                        <Badge variant="outline" className="text-[10px] tabular-nums">
                          {analysis.sections.length} found
                        </Badge>
                      </div>
                    </div>
                    <div className="p-5">
                      {analysis.sections.length === 0 ? (
                        <div className="py-8 text-center">
                          <FileText className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">No sections mapped from current facts.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                          {analysis.sections.map((sec, i) => (
                            <div
                              key={i}
                              className="group/item p-4 rounded-xl bg-gradient-to-r from-sage-light/40 to-transparent border border-primary/10 hover:border-primary/30 hover:shadow-sm transition-all duration-200 relative overflow-hidden"
                            >
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-primary/40 rounded-r-full" />
                              <div className="ml-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-semibold text-primary text-sm leading-tight">
                                    {sec.section}: {sec.title}
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-primary/30 shrink-0 group-hover/item:text-primary/60 group-hover/item:translate-x-0.5 transition-all" />
                                </div>
                                <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
                                  <span className="font-semibold text-foreground/60">Relevance:</span> {sec.relevance}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Critical Gaps */}
                <div className="reveal group">
                  <div className="h-full rounded-[1.5rem] border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                    <div className="p-5 border-b border-border/30 bg-gradient-to-r from-destructive/[0.04] to-transparent">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-display flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                          </div>
                          Critical Legal Gaps
                        </h2>
                        <Badge
                          variant={analysis.gaps.length === 0 ? "default" : "destructive"}
                          className="text-[10px] tabular-nums"
                        >
                          {analysis.gaps.length === 0 ? "All Clear" : `${analysis.gaps.length} found`}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-5">
                      {analysis.gaps.length === 0 ? (
                        <div className="py-8 text-center">
                          <div className="w-14 h-14 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center mx-auto mb-3">
                            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                          </div>
                          <p className="text-sm font-semibold text-emerald-800 mb-1">No Critical Gaps!</p>
                          <p className="text-xs text-emerald-600/70">Your testimony covers all necessary elements.</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                          {analysis.gaps.map((gap, i) => (
                            <div
                              key={i}
                              className="group/gap p-4 rounded-xl bg-gradient-to-r from-rose-50/80 to-transparent border border-rose-100 hover:border-rose-200 hover:shadow-sm relative overflow-hidden transition-all duration-200"
                            >
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-400 to-rose-300 rounded-r-full" />
                              <div className="ml-2">
                                <div className="text-sm font-bold text-rose-900 mb-1.5 flex items-center gap-2">
                                  <span className="w-5 h-5 rounded bg-rose-100 flex items-center justify-center text-[10px] font-bold text-rose-500 shrink-0">
                                    {i + 1}
                                  </span>
                                  {gap.element}
                                </div>
                                <div className="text-xs text-rose-700/70 leading-relaxed font-medium">{gap.suggestion}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════
                  PRECEDENT EXPLORER
              ═══════════════════════════════════════════════════════════════ */}
              <div className="reveal">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-display flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                        <Gavel className="w-5 h-5 text-accent" />
                      </div>
                      Precedent Explorer
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 ml-[52px]">
                      Court cases dynamically retrieved based on your testimony.
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs tabular-nums hidden sm:flex">
                    <Search className="w-3 h-3 mr-1.5" />
                    {cases.length} precedents
                  </Badge>
                </div>

                <div className="grid lg:grid-cols-[420px_1fr] gap-6">
                  {/* Case List */}
                  <div className="space-y-3 overflow-y-auto max-h-[650px] pr-2 custom-scrollbar">
                    {cases.length === 0 ? (
                      <div className="py-16 text-center rounded-2xl border border-dashed border-border bg-card/50">
                        <Search className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground font-medium">No matching precedents found.</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Try adding more testimony data.</p>
                      </div>
                    ) : (
                      cases.map((c, idx) => {
                        const outcomeStr = typeof c.outcome === "string" ? c.outcome.toLowerCase() : "";
                        const outcome = outcomeConfig[outcomeStr] || { label: c.outcome || "Unknown", color: "text-muted-foreground", bg: "bg-muted", icon: "📋" };
                        const listSections = Array.isArray(c.sections) ? c.sections : [];
                        const isActive = selectedCase === c.id;

                        return (
                          <button
                            key={c.id || idx}
                            onClick={() => setSelectedCase(c.id)}
                            className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 group/case relative overflow-hidden ${
                              isActive
                                ? "bg-card border-primary/40 shadow-lg ring-2 ring-primary/15 scale-[1.01]"
                                : "bg-card/60 border-border/50 hover:bg-card hover:border-primary/20 hover:shadow-sm"
                            }`}
                          >
                            {/* Active indicator */}
                            {isActive && (
                              <div className="absolute left-0 top-3 bottom-3 w-1 bg-gradient-to-b from-primary to-gold rounded-r-full" />
                            )}

                            <div className="flex justify-between items-start gap-3 mb-3">
                              <div className="min-w-0">
                                <h3 className={`font-semibold text-sm leading-snug mb-1 transition-colors ${isActive ? "text-primary" : "text-foreground/90 group-hover/case:text-primary"}`}>
                                  {c.title || "Unknown Case"}
                                </h3>
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" /> {c.court || "Unknown Court"} · {c.year || "N/A"}
                                </p>
                              </div>
                              <div className={`px-3 py-1.5 rounded-xl text-sm font-bold tabular-nums shrink-0 transition-all ${
                                isActive
                                  ? "bg-primary text-primary-foreground shadow-md"
                                  : "bg-primary/10 text-primary"
                              }`}>
                                {c.relevance || 0}%
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${outcome.bg} ${outcome.color}`}>
                                {outcome.icon} {outcome.label}
                              </span>
                              {listSections.slice(0, 2).map((s: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/30">
                                  {s}
                                </span>
                              ))}
                              {listSections.length > 2 && (
                                <span className="text-[10px] text-muted-foreground/60">+{listSections.length - 2}</span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Case Detail Panel */}
                  <div className="min-h-[500px] lg:h-[650px]">
                    {activeCase ? (
                      <div className="h-full rounded-[1.5rem] bg-card border border-border/50 shadow-md flex flex-col overflow-hidden">
                        {/* Detail Header */}
                        <div className="p-6 md:p-8 bg-gradient-to-br from-primary/[0.06] via-transparent to-gold/[0.04] border-b border-border/30">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <h2 className="text-xl md:text-2xl font-display leading-tight text-foreground mb-2">{activeCase.title || "Unknown Case"}</h2>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1.5">
                                  <Gavel className="w-3.5 h-3.5" /> {activeCase.court}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-border" />
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5" /> {activeCase.year}
                                </span>
                              </div>
                            </div>
                            <div className="text-center p-4 bg-card rounded-2xl border border-border/50 shadow-sm min-w-[90px]">
                              <div className="text-3xl font-display text-primary leading-none">
                                <AnimatedNumber value={activeCase.relevance || 0} suffix="%" />
                              </div>
                              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold mt-1">Match</div>
                            </div>
                          </div>
                        </div>

                        {/* Detail Body */}
                        <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                          <div>
                            <h3 className="text-xs uppercase tracking-[0.15em] font-bold text-muted-foreground mb-3 flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5" /> Case Summary
                            </h3>
                            <p className="text-sm text-foreground/85 leading-relaxed">{activeCase.summary || "No summary available."}</p>
                          </div>

                          {/* Applicable sections */}
                          {Array.isArray(activeCase.sections) && activeCase.sections.length > 0 && (
                            <div>
                              <h3 className="text-xs uppercase tracking-[0.15em] font-bold text-muted-foreground mb-3 flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5" /> Applicable Sections
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                {activeCase.sections.map((s: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs px-3 py-1 bg-primary/5 border-primary/20 text-primary">
                                    {s}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {activeCase.matchAnalysis && (
                            <div className="rounded-2xl overflow-hidden border border-primary/15 bg-gradient-to-br from-primary/[0.04] to-gold/[0.03]">
                              <div className="bg-primary/[0.08] px-5 py-3.5 border-b border-primary/10">
                                <h3 className="text-xs uppercase tracking-[0.15em] font-bold text-primary flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4" />
                                  Why This Precedent Matters
                                </h3>
                              </div>
                              <div className="p-5">
                                <p className="text-sm text-foreground/80 leading-relaxed">{activeCase.matchAnalysis}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full rounded-[1.5rem] border border-dashed border-border bg-card/30 flex flex-col items-center justify-center text-center p-8">
                        <Gavel className="w-10 h-10 text-muted-foreground/20 mb-3" />
                        <p className="text-sm text-muted-foreground font-medium">Select a precedent from the list</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Click on a case to view its details</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}