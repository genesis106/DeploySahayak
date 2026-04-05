import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Brain, FileText, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const AIQuery = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<{ type: "user" | "ai"; content: string; data?: any }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/lawyer/dashboard/cases`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch cases");
        return res.json();
      })
      .then((data) => {
        // Filter out cases that have "Untitled Case"
        const validDocs = data.filter((c: any) => c.name !== "Untitled Case" && c.name !== "Untitled Client");
        setClients(validDocs);
      })
      .catch((err) => {
        console.error("Dashboard cases error:", err);
        toast({ title: "Failed to load cases", variant: "destructive" });
      });
  }, [toast]);

  const handleSend = () => {
    if (!input.trim() || !selectedCaseId) {
      if (!selectedCaseId) {
        toast({ title: "Please select a client", variant: "destructive" });
      }
      return;
    }
    const q = input;
    setMessages((prev) => [...prev, { type: "user", content: q }]);
    setInput("");
    setLoading(true);

    fetch(`${API_BASE_URL}/lawyer/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: selectedCaseId, query: q })
    })
      .then(res => res.json())
      .then(data => {
        setMessages((prev) => [...prev, { type: "ai", content: data.answer, data: data }]);
      })
      .catch(err => {
        console.error(err);
        setMessages((prev) => [...prev, { type: "ai", content: "Error: Could not reach the AI service." }]);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">AI Query Handler</h1>
          <p className="text-muted-foreground text-sm mt-1">Ask questions about your cases using AI-powered analysis</p>
        </div>
        
        {/* Case selector */}
        <div className="w-full md:w-64">
          <Select value={selectedCaseId} onValueChange={(val) => {
            setSelectedCaseId(val);
            setMessages([]); // clear chat on case switch
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select a Client Case" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.case})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary-light flex items-center justify-center mb-4">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Ask anything about {selectedCaseId ? clients.find(c => c.id === selectedCaseId)?.title : 'your cases'}</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">Try: "Who is the main suspect?" or "Summarize this case"</p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {["Who is the main suspect?", "Summarize this case", "What contradictions exist?"].map((q) => (
                <button key={q} onClick={() => setInput(q)} disabled={!selectedCaseId} className="px-4 py-2 rounded-full bg-card border border-border text-sm text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors disabled:opacity-50">
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
              {msg.data && msg.data.evidence && msg.data.evidence.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3 h-3 text-primary" />
                    <span className="text-muted-foreground">Confidence: {msg.data.confidence}%</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1"><FileText className="w-3 h-3" /> Supporting Evidence</p>
                    {msg.data.evidence.map((e: string, j: number) => (
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
          placeholder={`Ask a question about ${selectedCaseId ? clients.find(c => c.id === selectedCaseId)?.name : 'your cases'}...`}
          className="flex-1 px-4 py-2 text-sm bg-transparent focus:outline-none"
          disabled={!selectedCaseId || loading}
        />
        <Button variant="hero" size="icon" onClick={handleSend} disabled={!selectedCaseId || loading} className="rounded-lg">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default AIQuery;
