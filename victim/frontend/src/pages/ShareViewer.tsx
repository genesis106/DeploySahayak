import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { 
  Shield, 
  Download, 
  FileText, 
  Image, 
  Video, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

interface SharedMedia {
  id: string;
  filename: string;
  media_type: "photo" | "video" | "audio" | "document";
  cloudinary_url: string;
  tags: string[];
  size: number;
}

interface Fragment {
  id: string;
  content: string;
  timestamp: string;
  type: string;
  has_evidence: boolean;
}

interface SharedDocument {
  id: string;
  title: string;
  category: string;
  file_url: string;
  uploaded_at: string;
}

interface ShareData {
  case_id: string;
  case_title: string;
  case_description: string;
  media: SharedMedia[];
  fragments: Fragment[];
  documents: SharedDocument[];
  expires_at: string;
}

export default function ShareViewer() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ShareData | null>(null);

  useEffect(() => {
    const fetchSharedData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/share/${token}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Link invalid or expired");
        }
        const shared = await res.json();
        setData(shared);
      } catch (err: any) {
        console.error("ShareViewer Fetch Error:", err);
        if (err.message === "Failed to fetch") {
          setError("Network error: Could not reach the secure backend. Please ensure the Sahayak Backend (port 8000) is running and accessible.");
        } else {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchSharedData();
  }, [token]);

  const handleDownloadZip = () => {
    if (!data) return;
    window.location.href = `${API_BASE_URL}/cases/${data.case_id}/media/download-zip`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground animate-pulse">Decrypting secure channel...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive mb-6">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-display mb-2">Access Revoked or Expired</h1>
        <p className="text-muted-foreground max-w-md mx-auto mb-8">
          {error || "This secure link is no longer active."} Share links automatically expire after 48 hours for security, or may have been manually revoked by the investigator.
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-4 h-4" />
          Sahayak Secure Sharing Protocol
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50 h-16 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg tracking-tight">Sahayak Secure Share</span>
        </div>
        
        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-medium text-sage px-3 py-1 bg-sage-light/30 border border-sage/30 rounded-full">
          <Lock className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">E2E AES-256 Encrypted Profile</span>
          <span className="sm:hidden">Secure Access</span>
        </div>
      </header>

      <main className="pt-24 px-4 sm:px-6 container mx-auto max-w-5xl">
        {/* Case Info */}
        <div className="mb-10 text-center sm:text-left flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-10 border-b">
          <div>
            <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-2">
              <CheckCircle2 className="w-4 h-4" />
              Verified Case Evidence
            </div>
            <h1 className="text-4xl font-display mb-3">{data.case_title}</h1>
            <p className="text-muted-foreground max-w-2xl">{data.case_description || "No description provided for this case report."}</p>
          </div>
          
          <Button 
            variant="hero" 
            size="lg" 
            className="shadow-lg shadow-primary/20 shrink-0" 
            onClick={handleDownloadZip}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Case ZIP
          </Button>
        </div>

        {/* Cognitive Map Section */}
        {data.fragments && data.fragments.length > 0 && (
          <section className="mb-16">
            <h2 className="text-xl font-display mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Case Narrative (Cognitive Map)
            </h2>
            <div className="space-y-4">
              {data.fragments.map((frag) => (
                <div key={frag.id} className="p-5 rounded-2xl bg-card border border-border/50 relative overflow-hidden group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {frag.type || "Testimony"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{frag.timestamp}</span>
                      </div>
                      <p className="text-sm leading-relaxed">{frag.content}</p>
                    </div>
                    {frag.has_evidence && (
                      <div className="shrink-0 pt-1">
                        <CheckCircle2 className="w-5 h-5 text-primary" title="Evidence Linked" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Media Grid Section */}
        <section className="mb-16">
          <h2 className="text-xl font-display mb-6 flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            Media Evidence
            <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded-full text-muted-foreground ml-2">
              {data.media.length} files
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.media.map((item) => (
              <div key={item.id} className="group rounded-2xl bg-card border border-border/50 overflow-hidden hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/5">
                <div className="aspect-video bg-muted relative flex items-center justify-center overflow-hidden">
                  {item.media_type === "photo" ? (
                    <img src={item.cloudinary_url} alt={item.filename} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      {item.media_type === "video" ? <Video className="w-8 h-8" /> : (item.media_type === "audio" ? <Clock className="w-8 h-8 rotate-90" /> : <FileText className="w-8 h-8" />)}
                      <span className="text-[10px] font-medium uppercase tracking-widest">{item.media_type}</span>
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <a href={item.cloudinary_url} target="_blank" rel="noopener noreferrer" className="text-white text-xs font-medium flex items-center gap-1.5 hover:underline">
                      <Download className="w-3.5 h-3.5" />
                      Open Source
                    </a>
                  </div>
                </div>
                
                <div className="p-4">
                  <p className="text-sm font-semibold truncate mb-1 group-hover:text-primary transition-colors">{item.filename}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {(item.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                    <div className="flex gap-1">
                      {item.tags.slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="text-[9px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Documents Section */}
        {data.documents && data.documents.length > 0 && (
          <section className="mb-16">
            <h2 className="text-xl font-display mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Legal Documents
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.documents.map((doc) => (
                <a 
                  key={doc.id} 
                  href={doc.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:border-primary/40 hover:bg-muted/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sage-light flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{doc.title}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{doc.category}</p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Footer info */}
        <footer className="mt-20 p-8 rounded-3xl bg-sage-light/10 border border-sage/20 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-10 h-10 rounded-full bg-sage-light flex items-center justify-center text-primary">
              <Lock className="w-5 h-5" />
            </div>
          </div>
          <h3 className="font-display text-lg mb-1">Encrypted Transmission</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
            The media links displayed here are decrypted on-the-fly and served over a secure SSL layer. Metadata is protected via AES-256 at rest.
          </p>
          <div className="flex items-center justify-center gap-4 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Expires {new Date(data.expires_at).toLocaleDateString()}
            </span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>SAHAYAK PROTOCOL v2.0</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
