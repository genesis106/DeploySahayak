import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { useReveal } from "@/hooks/use-reveal";
import { Button } from "@/components/ui/button";
import { GitBranch, Mic, AlertTriangle, FileText, TrendingUp, Loader2, Play, Scale } from "lucide-react";
import { useCaseContext } from "@/contexts/CaseContext";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// ✨ Helper function to convert **text** into <strong> React elements!
const formatBoldText = (text: string) => {
  if (!text) return null;
  // Split the text by **...**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      // Remove the asterisks and wrap in a bold tag with primary color
      return (
        <strong key={index} className="text-primary font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Handle standard line breaks from the AI
    return <span key={index}>{part.split('\n').map((line, i, arr) => (
      <span key={i}>{line}{i !== arr.length - 1 && <br />}</span>
    ))}</span>;
  });
};

export default function Dashboard() {
  const revealRef = useReveal();
  const { activeCaseId, activeCaseName, cases, setActiveCaseId } = useCaseContext();
  
  const [fragments, setFragments] = useState<any[]>([]);
  const [fragmentCount, setFragmentCount] = useState(0);
  const [graphStats, setGraphStats] = useState({ nodes: 0, edges: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // ✨ Updated state to hold the detailed analysis
  const [analysis, setAnalysis] = useState<{
    completenessScore: number;
    gapsCount: number;
    gaps: any[];
    sections: any[];
    detailedAnalysis: string;
    analyzed: boolean;
  }>({ completenessScore: 0, gapsCount: 0, gaps: [], sections: [], detailedAnalysis: "", analyzed: false });

  const loadStats = async () => {
    if (!activeCaseId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${activeCaseId}/dashboard/stats`);
      const data = await res.json();
      
      setFragmentCount(data.fragment_count);
      setFragments(data.recent_fragments);
      setGraphStats({ nodes: data.graph_nodes, edges: data.graph_edges });
      
      // If we have detailed analysis, it means analysis has been run before
      if (data.detailed_analysis || data.case_strength > 0) {
        setAnalysis({
          completenessScore: data.case_strength,
          gapsCount: data.gaps_found,
          gaps: [], // We don't fetch full gaps list in stats to save payload, only the count
          sections: data.bns_sections,
          detailedAnalysis: data.detailed_analysis,
          analyzed: true,
        });
      }
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    }
  };

  useEffect(() => {
    loadStats();
  }, [activeCaseId]);

  const runAnalysis = async () => {
    if (!activeCaseId) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${activeCaseId}/legal/full-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_name: activeCaseName, draft_type: "FIR" })
      });
      const data = await res.json();
      
      setAnalysis({
        completenessScore: data.gap_analysis?.completeness_score || 0,
        gapsCount: data.gap_analysis?.gaps?.filter((g: any) => g.status === "missing").length || 0,
        gaps: data.gap_analysis?.gaps?.filter((g: any) => g.status === "missing") || [],
        sections: data.bns_mapping?.bns_sections || [],
        detailedAnalysis: data.bns_mapping?.detailed_analysis || "",
        analyzed: true,
      });
    } catch (err) {
      console.error("Analysis failed", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div ref={revealRef} className="min-h-screen bg-background">
      <Navbar />

      <div className="pt-20 px-4 sm:px-6 pb-8">
        <div className="container mx-auto max-w-7xl">
          <div className="reveal mb-8 flex justify-between items-end">
            <div>
              <div className="flex items-center gap-4 mb-1">
                <h1 className="text-3xl font-display">Case Dashboard</h1>
                <Select value={activeCaseId || ""} onValueChange={(val) => setActiveCaseId(val)}>
                  <SelectTrigger className="w-[200px] font-display text-xl h-10 border-input shadow-sm">
                    <SelectValue placeholder="Select a case" />
                  </SelectTrigger>
                  <SelectContent>
                    {cases.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="cursor-pointer">
                        {c.title || "Untitled Case"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-muted-foreground">Overview of testimony fragments, graph analysis, and legal mapping.</p>
            </div>
            <Button onClick={runAnalysis} disabled={isAnalyzing} variant="hero" className="shadow-lg">
              {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {isAnalyzing ? "Running AI Models..." : "Run Case Analysis"}
            </Button>
          </div>

          <div className="reveal grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Same top stats block as before... */}
            <div className="p-5 rounded-2xl bg-card border">
              <Mic className="w-5 h-5 text-primary mb-3" />
              <div className="text-2xl font-display">{fragmentCount}</div>
              <div className="text-sm text-muted-foreground">Total Fragments</div>
            </div>
            <div className="p-5 rounded-2xl bg-card border">
              <GitBranch className="w-5 h-5 text-graph-location mb-3" />
              <div className="text-2xl font-display">{graphStats.nodes}</div>
              <div className="text-sm text-muted-foreground">Graph Entities</div>
            </div>
            <div className="p-5 rounded-2xl bg-card border">
              <AlertTriangle className="w-5 h-5 text-accent mb-3" />
              <div className="text-2xl font-display">{analysis.gapsCount}</div>
              <div className="text-sm text-muted-foreground">Missing Elements</div>
            </div>
            <div className="p-5 rounded-2xl bg-card border">
              <TrendingUp className="w-5 h-5 text-primary mb-3" />
              <div className="text-2xl font-display">{analysis.completenessScore}%</div>
              <div className="text-sm text-muted-foreground">Case Strength</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
            <div className="space-y-6">
              
              {/* ✨ NEW: Detailed Legal Analysis Block ✨ */}
              {analysis.analyzed && analysis.detailedAnalysis && (
                <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <h2 className="text-lg font-display mb-3 flex items-center gap-2 text-primary">
                    <Scale className="w-5 h-5" /> Detailed Testimony Analysis
                  </h2>
                  <div className="text-sm text-foreground/80 leading-relaxed space-y-2">
                    {/* Passes the raw text through our bold formatter! */}
                    {formatBoldText(analysis.detailedAnalysis)}
                  </div>
                </div>
              )}

              {/* Gap Analysis */}
              <div className="p-6 rounded-2xl bg-card border animate-in fade-in slide-in-from-bottom-4 duration-700">
                <h2 className="text-lg font-display mb-4">Critical Legal Gaps</h2>
                {!analysis.analyzed ? (
                  <p className="text-sm text-muted-foreground">Run Case Analysis to detect missing legal elements.</p>
                ) : analysis.gaps.length === 0 ? (
                  <p className="text-sm text-primary font-medium">No critical gaps found! Your testimony is comprehensive.</p>
                ) : (
                  <div className="space-y-3">
                    {analysis.gaps.map((gap, i) => (
                      <div key={i} className="p-3 bg-red-50 border border-red-100 rounded-lg">
                        <div className="text-sm font-semibold text-red-900">{gap.element}</div>
                        <div className="text-xs text-red-700 mt-1">{gap.suggestion}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* BNS Sections */}
              <div className="p-6 rounded-2xl bg-card border animate-in fade-in slide-in-from-bottom-4 duration-700">
                <h2 className="text-lg font-display mb-4">Mapped BNS Sections</h2>
                {!analysis.analyzed ? (
                  <p className="text-sm text-muted-foreground">Run Case Analysis to map BNS sections.</p>
                ) : analysis.sections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No explicit crimes mapped from current facts.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {analysis.sections.map((sec, i) => (
                      <div key={i} className="p-3 rounded-lg bg-sage-light border border-primary/20">
                        <div className="font-semibold text-primary">{sec.section}: {sec.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">{sec.relevance}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 rounded-2xl bg-card border animate-in fade-in slide-in-from-bottom-4 duration-700">
                <h2 className="text-lg font-display mb-4">Recent Fragments</h2>
                <div className="space-y-3">
                  {fragments.map((f, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-lg bg-background border">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{f.content}</p>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mt-1">{f.cluster}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}