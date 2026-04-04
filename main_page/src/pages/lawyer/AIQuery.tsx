import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Brain, FileText, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

const sampleResponses = [
  {
    query: "Who is the main suspect in case DV-2024-0891?",
    answer: "Based on analysis of 3 testimonies, the primary suspect is **Rajesh Sharma** (husband of the victim). He is referenced in 87% of incident descriptions and linked to 5 distinct events of physical assault.",
    evidence: ["Testimony #1 — Direct mention of physical assault by husband", "Testimony #2 — Neighbor witnessed shouting and threats", "Phone records corroborate timeline of incidents"],
    confidence: 92,
  },
  {
    query: "Summarize case SA-2024-1102",
    answer: "Anjali Verma reported **6 months of workplace harassment** by her manager at TechCorp Ltd. Incidents include verbal abuse, inappropriate remarks, and career threats. Two colleagues have provided corroborating statements.",
    evidence: ["Email chain showing inappropriate messages", "HR complaint filed on Oct 15, 2024", "Witness statement from colleague"],
    confidence: 88,
  },
];

const AIQuery = () => {
  const [messages, setMessages] = useState<{ type: "user" | "ai"; content: string; data?: typeof sampleResponses[0] }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;
    const q = input;
    setMessages((prev) => [...prev, { type: "user", content: q }]);
    setInput("");
    setLoading(true);

    setTimeout(() => {
      const match = sampleResponses.find((r) => q.toLowerCase().includes("suspect")) || sampleResponses[1];
      setMessages((prev) => [...prev, { type: "ai", content: match.answer, data: match }]);
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">AI Query Handler</h1>
        <p className="text-muted-foreground text-sm mt-1">Ask questions about your cases using AI-powered analysis</p>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary-light flex items-center justify-center mb-4">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Ask anything about your cases</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">Try: "Who is the main suspect?" or "Summarize this case"</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {["Who is the main suspect?", "Summarize this case", "What contradictions exist?"].map((q) => (
                <button key={q} onClick={() => setInput(q)} className="px-4 py-2 rounded-full bg-card border border-border text-sm text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-2xl rounded-2xl p-4 ${msg.type === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.data && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3 h-3 text-primary" />
                    <span className="text-muted-foreground">Confidence: {msg.data.confidence}%</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1"><FileText className="w-3 h-3" /> Supporting Evidence</p>
                    {msg.data.evidence.map((e, j) => (
                      <p key={j} className="text-xs text-muted-foreground">• {e}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">AI is analyzing...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-3 bg-card border border-border rounded-xl p-2">
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask a question about your cases..."
          className="flex-1 px-4 py-2 text-sm bg-transparent focus:outline-none"
        />
        <Button variant="hero" size="icon" onClick={handleSend} disabled={loading} className="rounded-lg">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default AIQuery;
