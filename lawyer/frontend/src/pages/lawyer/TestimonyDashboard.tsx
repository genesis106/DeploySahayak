import { useState, useEffect } from "react";
import { Loader2, Globe, Paperclip, AlertCircle, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const clusterColors: Record<string, string> = {
  appearance: "border-orange-500 bg-orange-50 text-orange-950", 
  sensory: "border-pink-500 bg-pink-50 text-pink-950",
  location: "border-blue-500 bg-blue-50 text-blue-950", 
  witness: "border-emerald-500 bg-emerald-50 text-emerald-950",
  timeline: "border-purple-500 bg-purple-50 text-purple-950", 
  event: "border-slate-500 bg-slate-50 text-slate-950",
};

const getClusterColor = (cluster?: string) => clusterColors[cluster?.toLowerCase() || ""] || "border-border bg-background";

export default function TestimonyDashboard() {
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<any[]>([]);
  const [edges, setEdges] = useState<{ from: string; to: string; label: string }[]>([]);
  const [loadingMap, setLoadingMap] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedBubble, setSelectedBubble] = useState<string | null>(null);

  // Dragging state
  const [draggingBubble, setDraggingBubble] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetch(`${API_BASE_URL}/lawyer/dashboard/cases`)
      .then((res) => res.json())
      .then((data) => {
        const validClients = data.filter((c: any) => c.name && c.name !== "Untitled Case" && c.name !== "Untitled Client");
        setClients(validClients);
        if (validClients.length > 0) setSelectedCaseId(validClients[0].id);
      })
      .catch((err) => {
        console.error("Backend fetch error:", err);
        toast({ title: "Failed to fetch cases from Database", variant: "destructive" });
      })
      .finally(() => setLoadingCases(false));
  }, [toast]);

  useEffect(() => {
    if (!selectedCaseId) {
      setBubbles([]);
      setEdges([]);
      return;
    }
    
    setLoadingMap(true);
    setBubbles([]);
    setEdges([]);
    setSelectedBubble(null);

    Promise.all([
      fetch(`${API_BASE_URL}/cases/${selectedCaseId}/fragments`).then(r => r.json()),
      fetch(`${API_BASE_URL}/cases/${selectedCaseId}/fragments/edges`).then(r => r.json())
    ])
      .then(([fragmentsData, edgesData]) => {
        setBubbles(fragmentsData || []);
        if (edgesData && edgesData.edges) {
          setEdges(edgesData.edges);
        }
      })
      .catch((err) => {
        console.error("Map fetch error:", err);
        toast({ title: "Failed to fetch cognitive map", variant: "destructive" });
      })
      .finally(() => setLoadingMap(false));
  }, [selectedCaseId, toast]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold text-foreground">Lawyer Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Review authenticated testimonies and cognitive maps across clients.</p>
      </div>

      {loadingCases ? (
        <div className="py-20 flex flex-col items-center justify-center opacity-50">
           <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
           <p className="text-sm">Fetching legal evidence records...</p>
        </div>
      ) : clients.length === 0 ? (
         <div className="py-20 text-center border rounded-xl bg-card border-border border-dashed text-muted-foreground">
            No active cases found in the MongoDB database.
         </div>
      ) : (
        <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
          
          {/* Sidebar / Client Select */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Select Client</h3>
            <div className="space-y-2">
              {clients.map((client) => {
                const isActive = selectedCaseId === client.id;
                return (
                  <button
                    key={client.id}
                    onClick={() => setSelectedCaseId(client.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isActive 
                        ? "bg-primary border-primary shadow-md text-primary-foreground" 
                        : "bg-card border-border hover:bg-muted"
                    }`}
                  >
                    <div className="font-semibold truncate">{client.name || "Untitled Client"}</div>
                    <div className={`mt-1 text-xs truncate ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {client.case}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Map & Testimonies View */}
          <div className="space-y-4 min-w-0">
            {loadingMap ? (
                <div className="h-[500px] w-full rounded-2xl bg-card border border-border/50 flex flex-col items-center justify-center">
                   <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                   <p className="text-sm text-muted-foreground">Loading Cognitive Map...</p>
                </div>
            ) : (
              <div className="flex flex-col gap-6">
                
                {/* Visual Map Canvas */}
                <div className="relative w-full h-[600px] rounded-2xl bg-card border border-border/50 overflow-hidden touch-none" onClick={() => setSelectedBubble(null)}>
                  
                  {/* Zoom controls */}
                  <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 bg-background/80 border p-1 rounded-lg">
                    <button onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(z + 0.25, 3)); }} className="p-1.5 hover:bg-muted"><ZoomIn className="w-4 h-4"/></button>
                    <button onClick={(e) => { e.stopPropagation(); setZoom(1); }} className="px-1.5 py-1 text-[10px]">{Math.round(zoom * 100)}%</button>
                    <button onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(z - 0.25, 0.5)); }} className="p-1.5 hover:bg-muted"><ZoomOut className="w-4 h-4"/></button>
                  </div>
                  
                  <div className="absolute inset-0 origin-center transition-transform" style={{ transform: `scale(${zoom})` }}>
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                    
                    {bubbles.length === 0 ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                        <AlertCircle className="w-12 h-12 mb-3" />
                        <p>No testimony fragments mapped for this client yet.</p>
                      </div>
                    ) : (
                      <>
                        {/* SVG Layer for Connections */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                          <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                              <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-primary/40" />
                            </marker>
                          </defs>
                          {edges.map((edge, i) => {
                            const fromNode = bubbles.find(b => b.id === edge.from);
                            const toNode = bubbles.find(b => b.id === edge.to);
                            if (!fromNode || !toNode) return null;

                            return (
                              <g key={i}>
                                <line
                                  x1={`${fromNode.position.x}%`}
                                  y1={`${fromNode.position.y}%`}
                                  x2={`${toNode.position.x}%`}
                                  y2={`${toNode.position.y}%`}
                                  stroke="currentColor"
                                  className="text-primary/40"
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

                        {/* Nodes rendering */}
                        {bubbles.map((bubble) => (
                        <button
                          key={bubble.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedBubble(bubble.id); }}
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
                            {bubble.original_language && bubble.original_language !== "en" && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-0.5">
                                <Globe className="w-2.5 h-2.5" /> {bubble.original_language.toUpperCase()}
                              </span>
                            )}
                            {bubble.has_evidence && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium flex items-center gap-0.5">
                                <Paperclip className="w-2.5 h-2.5" /> Evidence
                              </span>
                            )}
                          </div>
                        </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* List View of Testimonies */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Testimony Log</h3>
                  {bubbles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No testimonies logged.</p>
                  ) : (
                    <div className="grid gap-3">
                      {bubbles.map((t) => (
                        <div key={t.id} className="bg-card rounded-lg p-4 border shadow-sm">
                          <p className="text-sm text-foreground mb-3 whitespace-pre-wrap"><span className="font-semibold">{clients.find(c => c.id === selectedCaseId)?.name || "Client"}:</span> {t.content}</p>
                          <div className="flex flex-wrap gap-2 items-center">
                            <Badge variant="outline" className={`border text-xs ${getClusterColor(t.cluster)}`}>
                              {t.cluster ? t.cluster.toUpperCase() : "UNKNOWN"}
                            </Badge>
                            {t.has_evidence && (
                              <Badge variant="outline" className="bg-amber-100/50 text-amber-800 border-amber-200">
                                Has Linked Evidence
                              </Badge>
                            )}
                            <span className="ml-auto text-xs text-muted-foreground">{t.timestamp || "Unknown time"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
