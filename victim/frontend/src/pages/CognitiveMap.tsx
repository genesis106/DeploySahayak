// src/pages/CognitiveMap.tsx
import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Mic, MicOff, Plus, Trash2, Sparkles, Send, Bot, ZoomIn, ZoomOut, ChevronDown, Loader2, Globe, Paperclip, Languages, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { useReveal } from "@/hooks/use-reveal";
import { useCaseContext } from "@/contexts/CaseContext";

interface MemoryBubble {
  id: string; type: "voice" | "text" | "sensory"; content: string;
  timestamp: string; cluster?: string; position: { x: number; y: number };
  has_evidence?: boolean; original_text?: string; original_language?: string;
  linked_evidence?: { evidence_id: string; file_name: string; type: string }[];
}

interface ChatMessage { role: "user" | "assistant"; content: string; has_contradiction?: boolean; timestamp?: string; original_language?: string; }

interface Language { code: string; name: string; locale: string; }

interface MediaFile { id: string; filename: string; media_type: string; linked_cluster_id?: string | null; }

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const clusterColors: Record<string, string> = {
  appearance: "border-orange-500 bg-orange-50 text-orange-950", sensory: "border-pink-500 bg-pink-50 text-pink-950",
  location: "border-blue-500 bg-blue-50 text-blue-950", witness: "border-emerald-500 bg-emerald-50 text-emerald-950",
  timeline: "border-purple-500 bg-purple-50 text-purple-950", event: "border-slate-500 bg-slate-50 text-slate-950",
};

const getClusterColor = (cluster?: string) => clusterColors[cluster?.toLowerCase() || ""] || "border-border bg-background";

const langFlags: Record<string, string> = {
  en: "🇬🇧", hi: "🇮🇳", mr: "🇮🇳", ta: "🇮🇳", te: "🇮🇳", bn: "🇮🇳", kn: "🇮🇳", ml: "🇮🇳", gu: "🇮🇳", pa: "🇮🇳",
};

export default function CognitiveMap() {
  const revealRef = useReveal();
  const { activeCaseId, activeCaseName, cases, setActiveCaseId, createNewCase, refreshCases, deleteCase } = useCaseContext();
  
  const [bubbles, setBubbles] = useState<MemoryBubble[]>([]);
  const [edges, setEdges] = useState<{ from: string; to: string; label: string }[]>([]);
  
  const [selectedBubble, setSelectedBubble] = useState<string | null>(null);
  const [showPastCases, setShowPastCases] = useState(false);
  const [draggingBubble, setDraggingBubble] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingBubble, setEditingBubble] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  
  const [newCaseName, setNewCaseName] = useState(activeCaseName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<string>("all");
  const [zoom, setZoom] = useState(1);

  const [manualContent, setManualContent] = useState("");
  const [manualCluster, setManualCluster] = useState(Object.keys(clusterColors)[0]);
  const [isAddingManual, setIsAddingManual] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isCreatingClusters, setIsCreatingClusters] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const transcriptRef = useRef("");
  const isRecordingRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Multilingual state ──────────────────────────────────────────────────
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [translatingBubbleId, setTranslatingBubbleId] = useState<string | null>(null);
  const [translatedText, setTranslatedText] = useState<string>("");
  const [translateTargetLang, setTranslateTargetLang] = useState<string>("hi");

  // ── Evidence linking state ──────────────────────────────────────────────
  const [showEvidenceLink, setShowEvidenceLink] = useState(false);
  const [caseMedia, setCaseMedia] = useState<MediaFile[]>([]);
  const [linkingMediaId, setLinkingMediaId] = useState<string | null>(null);

  const apiCall = async (endpoint: string, method = "GET", body: any = null) => {
    const options: RequestInit = { method, headers: {} };
    if (body) { options.body = JSON.stringify(body); options.headers = { "Content-Type": "application/json" }; }
    const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  };

  // Load supported languages on mount
  useEffect(() => {
    async function loadLanguages() {
      try {
        const data = await apiCall("/languages");
        setLanguages(data.languages || []);
      } catch { setLanguages([{ code: "en", name: "English", locale: "en-IN" }]); }
    }
    loadLanguages();
  }, []);

  useEffect(() => { setNewCaseName(activeCaseName); }, [activeCaseName]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  useEffect(() => {
    if (activeCaseId) {
      setBubbles([]);
      setEdges([]);
      setChatMessages([]);
      setManualContent("");
      setEditingBubble(null);
      setSelectedBubble(null);
      fetchMapData();
      loadChatHistory();
      loadCaseMedia();
    } else {
      setBubbles([]);
      setEdges([]);
      setChatMessages([]);
    }
  }, [activeCaseId]);

  // Setup speech recognition with language support
  useEffect(() => {
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true; rec.interimResults = true;
      // Set language based on selection
      const langObj = languages.find(l => l.code === selectedLanguage);
      rec.lang = langObj?.locale || "en-IN";
      rec.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; ++i) currentTranscript += event.results[i][0].transcript;
        transcriptRef.current = currentTranscript;
        setChatInput(currentTranscript);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (isRecordingRef.current) {
            isRecordingRef.current = false; setIsRecording(false); rec.stop();
            if (transcriptRef.current.trim()) sendChatMessage(transcriptRef.current);
          }
        }, 3000);
      };
      rec.onerror = (e: any) => { if (e.error !== 'no-speech') { setIsRecording(false); isRecordingRef.current = false; } };
      rec.onend = () => { if (isRecordingRef.current) try { rec.start(); } catch (e) {} else setIsRecording(false); };
      setRecognition(rec);
    }
  }, [activeCaseId, selectedLanguage, languages]);

  const loadChatHistory = async () => {
    if (!activeCaseId) return;
    try {
      const data = await apiCall(`/cases/${activeCaseId}/chat/history`);
      setChatMessages(data?.messages || []);
    } catch { setChatMessages([]); }
  };

  const loadCaseMedia = async () => {
    if (!activeCaseId) return;
    try {
      const data = await apiCall(`/cases/${activeCaseId}/media`);
      setCaseMedia(data || []);
    } catch { setCaseMedia([]); }
  };

  const fetchMapData = async () => {
    if (!activeCaseId) return;
    try {
      const fragments = await apiCall(`/cases/${activeCaseId}/fragments`);
      setBubbles(fragments);
      
      const edgesData = await apiCall(`/cases/${activeCaseId}/fragments/edges`);
      if (edgesData && edgesData.edges) {
        setEdges(edgesData.edges);
      }
    } catch (e) { console.error("Map fetch error:", e); }
  };

  const handleManualAdd = async () => {
    if (!manualContent.trim() || isAddingManual || !activeCaseId) return;
    setIsAddingManual(true);
    try {
      const newFrag = await apiCall(`/cases/${activeCaseId}/fragments`, "POST", {
        content: manualContent, cluster: manualCluster, type: "text", timestamp: "Just now", position: { x: 50, y: 50 }
      });
      setBubbles(prev => [...prev, newFrag]);
      setManualContent("");
    } finally { setIsAddingManual(false); }
  };

  const sendChatMessage = async (messageText?: string) => {
    const text = messageText || chatInput;
    if (!text.trim() || isSending) return;

    let targetCaseId = activeCaseId;
    if (!targetCaseId) {
      targetCaseId = await createNewCase("Untitled Case");
      if (!targetCaseId) return;
    }
    
    setChatInput(""); setIsSending(true);
    setChatMessages(prev => [...prev, { role: "user", content: text, timestamp: new Date().toISOString(), original_language: selectedLanguage }]);

    try {
      const data = await apiCall(`/cases/${targetCaseId}/chat`, "POST", { message: text, language: selectedLanguage });
      setChatMessages(prev => [...prev, { role: "assistant", content: data.reply, has_contradiction: data.has_contradiction }]);
      if (data.has_contradiction) {
        if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(data.reply)); }
        if (isRecordingRef.current && recognition) { recognition.stop(); setIsRecording(false); isRecordingRef.current = false; }
      }
    } finally { setIsSending(false); }
  };

  const createClusters = async () => {
    if (isCreatingClusters || !activeCaseId) return;
    setIsCreatingClusters(true);
    try {
      const data = await apiCall(`/cases/${activeCaseId}/chat/create-clusters`, "POST", {});
      if (data.fragments) setBubbles(data.fragments);
      
      const edgesData = await apiCall(`/cases/${activeCaseId}/fragments/edges`);
      if (edgesData && edgesData.edges) setEdges(edgesData.edges);
      
      setChatMessages(prev => [...prev, { role: "assistant", content: `✅ Clusters created! ${data.fragments?.length || 0} fragments have been placed on the map.` }]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: "assistant", content: `❌ Failed to create clusters.` }]);
    } finally { setIsCreatingClusters(false); }
  };

  const handleUpdateName = async () => {
    if (!activeCaseId || !newCaseName.trim()) return;
    await apiCall(`/cases/${activeCaseId}`, "PATCH", { title: newCaseName });
    await refreshCases();
    setIsEditingName(false);
  };

  const removeBubble = async (id: string) => {
    if(!activeCaseId) return;
    await apiCall(`/cases/${activeCaseId}/fragments/${id}`, "DELETE");
    setBubbles(b => b.filter(x => x.id !== id));
    setSelectedBubble(null);
  };

  const saveEdit = async () => {
    if (!editingBubble || !activeCaseId) return;
    const data = await apiCall(`/cases/${activeCaseId}/fragments/${editingBubble}`, "PUT", { content: editText });
    setBubbles(prev => prev.map(b => b.id === editingBubble ? data : b));
    setEditingBubble(null);
  };

  const toggleRecording = () => {
    if (!isRecording && recognition) {
      transcriptRef.current = ""; setChatInput(""); setIsRecording(true); isRecordingRef.current = true;
      // Update language on the recognition instance before starting
      const langObj = languages.find(l => l.code === selectedLanguage);
      if (langObj) recognition.lang = langObj.locale;
      try { recognition.start(); } catch (e) { setIsRecording(false); isRecordingRef.current = false; }
    } else {
      isRecordingRef.current = false; if (recognition) recognition.stop(); setIsRecording(false);
      if (transcriptRef.current.trim()) sendChatMessage(transcriptRef.current);
    }
  };

  // ── Translate a fragment for display ────────────────────────────────────
  const handleTranslateBubble = async (bubbleId: string) => {
    const bubble = bubbles.find(b => b.id === bubbleId);
    if (!bubble) return;
    setTranslatingBubbleId(bubbleId);
    try {
      const data = await apiCall("/translate", "POST", { text: bubble.content, target_language: translateTargetLang });
      setTranslatedText(data.translated_text);
    } catch {
      toast.error("Translation failed");
      setTranslatingBubbleId(null);
    }
  };

  // ── Link media to a cluster ────────────────────────────────────────────
  const handleLinkEvidence = async (mediaId: string) => {
    if (!activeCaseId || !selectedBubble) return;
    setLinkingMediaId(mediaId);
    try {
      await apiCall(`/cases/${activeCaseId}/media/${mediaId}/link-cluster`, "POST", { cluster_id: selectedBubble });
      toast.success("Evidence linked to cluster!");
      await fetchMapData();
      await loadCaseMedia();
      setShowEvidenceLink(false);
    } catch {
      toast.error("Failed to link evidence");
    } finally { setLinkingMediaId(null); }
  };

  const filteredBubbles = selectedCluster === "all" ? bubbles : bubbles.filter(b => b.cluster?.toLowerCase() === selectedCluster);

  // Drag logic handlers
  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (draggingBubble !== id) return;
    const container = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!container) return;
    const x = ((e.clientX - dragOffset.x - container.left) / container.width) * 100;
    const y = ((e.clientY - dragOffset.y - container.top) / container.height) * 100;
    setBubbles(prev => prev.map(b => b.id === id ? { ...b, position: { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } } : b));
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDraggingBubble(null);
  };

  const unlinkedMedia = caseMedia.filter(m => !m.linked_cluster_id);

  return (
    <div ref={revealRef} className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 px-4 sm:px-6 pb-8">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <div className="reveal mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-display font-semibold text-sage-dark mb-2">
                Cognitive Map <span className="text-muted-foreground/30 mx-2">/</span>
                <span className={`cursor-pointer hover:text-primary ${isEditingName ? 'hidden' : 'inline'}`} onClick={() => setIsEditingName(true)}>
                  {activeCaseName}
                </span>
                <input
                  type="text" autoFocus
                  className={`bg-transparent border-b border-primary outline-none ${isEditingName ? 'inline' : 'hidden'}`}
                  value={newCaseName} onChange={(e) => setNewCaseName(e.target.value)}
                  onBlur={handleUpdateName} onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
                />
              </h1>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => {
                toast.success("Case saved securely to vault.")
              }} variant="ghost" className="border-primary/20 text-primary hover:bg-primary/5">
                <Sparkles className="w-4 h-4 mr-2" /> Save Case
              </Button>
              <Button onClick={async () => {
                  const id = await createNewCase();
                  if (id) toast.success("New blank case created!");
                }} variant="outline" className="border-primary/20 text-primary hover:bg-primary/5">
                + New Blank Case
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_380px] gap-6">
            {/* Canvas */}
            <div className="reveal" style={{ transitionDelay: "100ms" }}>
              <div className="mb-3 flex items-center gap-3">
                <select value={selectedCluster} onChange={(e) => setSelectedCluster(e.target.value)} className="h-9 px-3 text-sm bg-card border border-border/50 rounded-lg outline-none">
                  <option value="all">All Clusters</option>
                  {Object.keys(clusterColors).map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
                <span className="text-xs text-muted-foreground">{filteredBubbles.length} fragments</span>
              </div>
              <div className="relative w-full h-[700px] rounded-2xl bg-card border border-border/50 overflow-hidden touch-none" onClick={() => { setSelectedBubble(null); setTranslatingBubbleId(null); }}>
                
                {/* Zoom controls */}
                <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 bg-background/80 border p-1 rounded-lg">
                  <button onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(z + 0.25, 3)); }} className="p-1.5 hover:bg-muted"><ZoomIn className="w-4 h-4"/></button>
                  <button onClick={(e) => { e.stopPropagation(); setZoom(1); }} className="px-1.5 py-1 text-[10px]">{Math.round(zoom * 100)}%</button>
                  <button onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(z - 0.25, 0.5)); }} className="p-1.5 hover:bg-muted"><ZoomOut className="w-4 h-4"/></button>
                </div>
                
                <div className="absolute inset-0 origin-center transition-transform" style={{ transform: `scale(${zoom})` }}>
                  <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                  
                  {/* SVG Layer for Connections */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-primary/30" />
                      </marker>
                    </defs>
                    {edges.map((edge, i) => {
                      const fromNode = bubbles.find(b => b.id === edge.from);
                      const toNode = bubbles.find(b => b.id === edge.to);
                      
                      if (!fromNode || !toNode || !filteredBubbles.find(b => b.id === fromNode.id) || !filteredBubbles.find(b => b.id === toNode.id)) return null;

                      return (
                        <g key={i}>
                          <line
                            x1={`${fromNode.position.x}%`}
                            y1={`${fromNode.position.y}%`}
                            x2={`${toNode.position.x}%`}
                            y2={`${toNode.position.y}%`}
                            stroke="currentColor"
                            className="text-primary/30"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                            markerEnd="url(#arrowhead)"
                          />
                          <text
                            x={`${(fromNode.position.x + toNode.position.x) / 2}%`}
                            y={`${(fromNode.position.y + toNode.position.y) / 2}%`}
                            className="text-[10px] fill-muted-foreground font-medium"
                            textAnchor="middle"
                            dy="-5"
                          >
                            {edge.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Nodes rendering... */}
                  {filteredBubbles.map((bubble) => (
                  <button
                    key={bubble.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedBubble(bubble.id); setTranslatingBubbleId(null); }}
                    onPointerDown={(e) => {
                      e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
                      const rect = e.currentTarget.getBoundingClientRect();
                      setDragOffset({ x: e.clientX - (rect.left + rect.width / 2), y: e.clientY - (rect.top + rect.height / 2) });
                      setDraggingBubble(bubble.id); setSelectedBubble(bubble.id);
                    }}
                    onPointerMove={(e) => handlePointerMove(e, bubble.id)}
                    onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
                    className={`absolute max-w-[220px] p-3 rounded-xl border-2 bubble-shadow text-left text-sm cursor-grab ${getClusterColor(bubble.cluster)} ${selectedBubble === bubble.id ? "ring-2 ring-primary scale-105 z-50" : "z-10"}`}
                    style={{ left: `${bubble.position.x}%`, top: `${bubble.position.y}%`, transform: "translate(-50%, -50%)" }}
                  >
                    <p className="text-foreground leading-snug line-clamp-3">{bubble.content}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-semibold uppercase opacity-60">{bubble.cluster}</span>
                      {/* Language badge */}
                      {bubble.original_language && bubble.original_language !== "en" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-0.5">
                          <Globe className="w-2.5 h-2.5" /> {bubble.original_language.toUpperCase()}
                        </span>
                      )}
                      {/* Evidence indicator */}
                      {bubble.has_evidence && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium flex items-center gap-0.5">
                          <Paperclip className="w-2.5 h-2.5" /> Evidence
                        </span>
                      )}
                    </div>
                    {/* Linked evidence details */}
                    {bubble.linked_evidence && bubble.linked_evidence.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {bubble.linked_evidence.map((ev, idx) => (
                          <div key={idx} className="text-[9px] text-amber-700 truncate">
                            📎 {ev.file_name} ({ev.type})
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Translation tooltip */}
                    {translatingBubbleId === bubble.id && translatedText && (
                      <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-primary flex items-center gap-1"><Languages className="w-3 h-3" /> Translation</span>
                          <button onClick={(e) => { e.stopPropagation(); setTranslatingBubbleId(null); setTranslatedText(""); }}><X className="w-3 h-3 text-muted-foreground" /></button>
                        </div>
                        <p className="text-foreground/80">{translatedText}</p>
                      </div>
                    )}
                  </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="reveal space-y-4" style={{ transitionDelay: "200ms" }}>

              {/* Language selector */}
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-card border border-border/50">
                <Globe className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-muted-foreground">Voice Language:</span>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="flex-1 h-8 px-2 text-sm bg-background border border-border/50 rounded-lg outline-none focus:ring-1 focus:ring-primary"
                >
                  {languages.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {langFlags[lang.code] || "🌐"} {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chatbot */}
              <div className="rounded-2xl bg-card border border-border/50 flex flex-col h-[450px]">
                <div className="p-4 border-b flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  <div><h3 className="font-semibold text-sm">Past Testimony & Case Chat</h3></div>
                  {selectedLanguage !== "en" && (
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {langFlags[selectedLanguage]} {languages.find(l => l.code === selectedLanguage)?.name}
                    </span>
                  )}
                  {isRecording && <span className="ml-auto flex items-center gap-1.5 text-xs text-destructive animate-pulse"><span className="w-2 h-2 rounded-full bg-destructive"/>Listening</span>}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : msg.has_contradiction ? "bg-red-50 text-red-900 border" : "bg-muted text-foreground"}`}>
                        {msg.has_contradiction && <div className="text-xs font-semibold text-red-600 mb-1">⚠️ Contradiction Detected</div>}
                        {msg.content}
                        {/* Show language badge for non-English user messages */}
                        {msg.role === "user" && msg.original_language && msg.original_language !== "en" && (
                          <div className="mt-1 text-[10px] opacity-70 flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" /> Translated from {languages.find(l => l.code === msg.original_language)?.name || msg.original_language}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t flex gap-2">
                  <button onClick={toggleRecording} className={`w-9 h-9 rounded-full flex items-center justify-center ${isRecording ? 'bg-destructive text-white animate-pulse' : 'bg-muted'}`}>
                    {isRecording ? <MicOff className="w-4 h-4"/> : <Mic className="w-4 h-4"/>}
                  </button>
                  <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChatMessage()} className="flex-1 h-9 px-3 rounded-lg bg-background border" placeholder={`Type testimony${selectedLanguage !== "en" ? ` (${languages.find(l => l.code === selectedLanguage)?.name})` : ""}...`} />
                  <Button onClick={() => sendChatMessage()} size="sm" className="h-9 w-9 p-0"><Send className="w-4 h-4"/></Button>
                </div>
              </div>

              <Button onClick={createClusters} disabled={isCreatingClusters || chatMessages.length === 0} variant="hero" className="w-full">
                {isCreatingClusters ? <Loader2 className="animate-spin mr-2"/> : <Sparkles className="mr-2"/>} Create Clusters
              </Button>

              {/* Selected Bubble Actions */}
              {selectedBubble && (
                <div className="p-4 rounded-2xl bg-card border space-y-3">
                  {editingBubble ? (
                    <div className="space-y-2">
                      <textarea value={editText} onChange={e => setEditText(e.target.value)} className="w-full h-20 p-2 border rounded text-sm"/>
                      <div className="flex gap-2"><Button size="sm" onClick={saveEdit}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditingBubble(null)}>Cancel</Button></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm">{bubbles.find(b => b.id === selectedBubble)?.content}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditingBubble(selectedBubble); setEditText(bubbles.find(b => b.id === selectedBubble)?.content || ""); }}>Edit</Button>
                        <Button size="sm" variant="destructive" onClick={() => removeBubble(selectedBubble)}>Remove</Button>
                        {/* Translate button */}
                        <div className="flex items-center gap-1">
                          <select
                            value={translateTargetLang}
                            onChange={e => setTranslateTargetLang(e.target.value)}
                            className="h-8 px-2 text-xs bg-background border rounded-lg outline-none"
                          >
                            {languages.filter(l => l.code !== "en").map(l => (
                              <option key={l.code} value={l.code}>{langFlags[l.code]} {l.name}</option>
                            ))}
                          </select>
                          <Button size="sm" variant="outline" onClick={() => handleTranslateBubble(selectedBubble)} className="gap-1">
                            <Languages className="w-3.5 h-3.5" /> Translate
                          </Button>
                        </div>
                      </div>
                      {/* Link Evidence button */}
                      <div>
                        <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => { setShowEvidenceLink(!showEvidenceLink); }}>
                          <Paperclip className="w-3.5 h-3.5" /> Link Evidence
                        </Button>
                        {showEvidenceLink && (
                          <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5 p-2 bg-background rounded-lg border">
                            {unlinkedMedia.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">No unlinked media. Upload in Media Upload first.</p>
                            ) : unlinkedMedia.map(m => (
                              <button
                                key={m.id}
                                onClick={() => handleLinkEvidence(m.id)}
                                disabled={linkingMediaId === m.id}
                                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-left text-xs transition-colors"
                              >
                                <span>{m.media_type === "photo" ? "📸" : m.media_type === "video" ? "🎥" : m.media_type === "audio" ? "🎙" : "📄"}</span>
                                <span className="truncate flex-1">{m.filename}</span>
                                {linkingMediaId === m.id && <Loader2 className="w-3 h-3 animate-spin" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Past Cases Dropdown */}
              <div className="p-4 rounded-2xl bg-card border">
                <Button onClick={() => setShowPastCases(!showPastCases)} variant="secondary" className="w-full">
                  {showPastCases ? "Hide Past Cases" : "View Past Cases"}
                </Button>
                {showPastCases && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                    {cases.map((c) => (
                      <div
                        key={c.id}
                        className={`p-3 text-sm rounded-lg cursor-pointer flex justify-between items-center transition-all ${
                          c.id === activeCaseId
                            ? "bg-primary text-primary-foreground font-semibold shadow-md"
                            : "bg-background hover:bg-secondary border border-border"
                        }`}
                      >
                        <div 
                          className="flex-1 truncate"
                          onClick={() => {
                            setActiveCaseId(c.id);
                            setShowPastCases(false);
                          }}
                        >
                          {c.title || "Untitled Case"}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCase(c.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}