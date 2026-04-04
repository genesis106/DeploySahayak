import { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { useReveal } from "@/hooks/use-reveal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCaseContext } from "@/contexts/CaseContext";
import { toast } from "sonner";
import {
  Upload,
  Image,
  Video,
  FileText,
  X,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Lock,
  Eye,
  FolderOpen,
  Edit2,
  Check,
  Tag as TagIcon,
  Mic,
  Link2
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

type MediaType = "photo" | "video" | "audio" | "document";
type UploadStatus = "pending" | "uploading" | "done" | "error";

interface MediaFile {
  id: string;
  name: string;
  type: MediaType;
  size: string;
  status: UploadStatus;
  progress: number;
  timestamp: string;
  tags?: string[];
  cloudinary_url?: string;
  linked_cluster_id?: string | null;
}

interface ClusterFragment {
  id: string;
  content: string;
  cluster: string;
}

const typeConfig: Record<MediaType, { icon: typeof Image; label: string; accept: string; color: string }> = {
  photo: { icon: Image, label: "Photos", accept: "image/*", color: "bg-sage-light text-primary" },
  video: { icon: Video, label: "Videos", accept: "video/*", color: "bg-gold-light text-accent-foreground" },
  audio: { icon: Mic, label: "Audio", accept: "audio/*", color: "bg-purple-100 text-purple-700" },
  document: { icon: FileText, label: "Documents", accept: ".pdf,.doc,.docx,.txt", color: "bg-sky-soft text-graph-location" },
};

const evidenceTags = [
  "Injury Photo",
  "Location Evidence",
  "Communication Screenshot",
  "Medical Report",
  "Witness Statement",
  "Identity Document",
  "Other",
];

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function MediaUpload() {
  const revealRef = useReveal();
  const { activeCaseId, cases, setActiveCaseId } = useCaseContext();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [activeType, setActiveType] = useState<MediaType | "all">("all");
  const [dragOver, setDragOver] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // File rename state
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fileInputRefs = useRef<Record<MediaType, HTMLInputElement | null>>({
    photo: null,
    video: null,
    audio: null,
    document: null,
  });

  // Cluster linking state
  const [clusters, setClusters] = useState<ClusterFragment[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string>("");

  const fetchMedia = useCallback(async () => {
    if (!activeCaseId) {
      setFiles([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${activeCaseId}/media`);
      if (!res.ok) return;
      const data = await res.json();
      const mapped: MediaFile[] = data.map((item: any) => ({
        id: item.id,
        name: item.filename,
        type: item.media_type as MediaType,
        size: formatFileSize(item.size),
        status: "done" as UploadStatus,
        progress: 100,
        timestamp: new Date(item.uploaded_at).toLocaleString("en-IN", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
        }),
        tags: item.tags || [],
        cloudinary_url: item.cloudinary_url,
        linked_cluster_id: item.linked_cluster_id || null,
      }));
      setFiles(mapped);
    } catch (err) {
      console.error("Failed to fetch media:", err);
      toast.error("Failed to load media");
    }
  }, [activeCaseId]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Fetch clusters for the active case
  useEffect(() => {
    async function loadClusters() {
      if (!activeCaseId) { setClusters([]); return; }
      try {
        const res = await fetch(`${API_BASE_URL}/cases/${activeCaseId}/fragments`);
        if (res.ok) {
          const data = await res.json();
          setClusters(data.map((f: any) => ({ id: f.id, content: f.content, cluster: f.cluster || "unknown" })));
        }
      } catch { setClusters([]); }
    }
    loadClusters();
  }, [activeCaseId]);

  const handleFileUpload = async (fileObj: File, type: MediaType) => {
    if (!activeCaseId) {
      toast.error("Please select a case first");
      return;
    }

    const tempId = Date.now().toString();
    const newFile: MediaFile = {
      id: tempId,
      name: fileObj.name,
      type,
      size: formatFileSize(fileObj.size),
      status: "uploading",
      progress: 10,
      timestamp: "Just now",
      tags: [...selectedTags],
    };
    setFiles((prev) => [newFile, ...prev]);

    const progressInterval = setInterval(() => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === tempId && f.status === "uploading"
            ? { ...f, progress: Math.min(f.progress + Math.random() * 20, 90) }
            : f
        )
      );
    }, 400);

    try {
      const formData = new FormData();
      formData.append("file", fileObj);
      if (selectedTags.length > 0) {
        formData.append("tags", selectedTags.join(","));
      }
      if (selectedClusterId) {
        formData.append("linked_cluster_id", selectedClusterId);
      }

      const res = await fetch(`${API_BASE_URL}/cases/${activeCaseId}/media/upload`, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      toast.success("File uploaded securely");

      setFiles((prev) =>
        prev.map((f) =>
          f.id === tempId
            ? {
                ...f,
                id: data.id,
                status: "done" as UploadStatus,
                progress: 100,
                cloudinary_url: data.cloudinary_url,
                tags: data.tags,
                linked_cluster_id: data.linked_cluster_id || null,
                timestamp: new Date(data.uploaded_at).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                })
              }
            : f
        )
      );
    } catch (err) {
      clearInterval(progressInterval);
      toast.error("Upload failed");
      setFiles((prev) =>
        prev.map((f) => (f.id === tempId ? { ...f, status: "error" as UploadStatus, progress: 0 } : f))
      );
    }
  };

  const handleUploadClick = (type: MediaType) => fileInputRefs.current[type]?.click();

  const handleFileInputChange = (type: MediaType, e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      Array.from(fileList).forEach((file) => handleFileUpload(file, type));
    }
    e.target.value = "";
  };

  const removeFile = async (id: string, name: string) => {
    if (!confirm(`Permanently delete ${name}?`)) return;
    try {
      await fetch(`${API_BASE_URL}/media/${id}`, { method: "DELETE" });
      setFiles((prev) => prev.filter((f) => f.id !== id));
      toast.success("File deleted");
    } catch (err) {
      toast.error("Failed to delete file");
    }
  };

  const startRename = (id: string, currentName: string) => {
    setEditingFileId(id);
    setEditName(currentName);
  };

  const saveRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/media/${id}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: editName }),
      });
      if (!res.ok) throw new Error("Rename failed");
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: editName } : f)));
      toast.success("File renamed");
    } catch (err) {
      toast.error("Failed to rename file");
    }
    setEditingFileId(null);
  };

  // Quick tag addition on an existing file
  const addTagToFile = async (id: string, currentTags: string[], newTag: string) => {
    if (currentTags.includes(newTag)) return;
    const updatedTags = [...currentTags, newTag];
    try {
      await fetch(`${API_BASE_URL}/media/${id}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: updatedTags }),
      });
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, tags: updatedTags } : f)));
      toast.success("Tag added");
    } catch (err) {
      toast.error("Failed to add tag");
    }
  };

  const removeTagFromFile = async (id: string, currentTags: string[], tagToRemove: string) => {
    const updatedTags = currentTags.filter((t) => t !== tagToRemove);
    try {
      await fetch(`${API_BASE_URL}/media/${id}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: updatedTags }),
      });
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, tags: updatedTags } : f)));
    } catch (err) {
      toast.error("Failed to remove tag");
    }
  };

  const filtered = activeType === "all" ? files : files.filter((f) => f.type === activeType);

  return (
    <div ref={revealRef} className="min-h-screen bg-background pb-12">
      <Navbar />

      {(Object.keys(typeConfig) as MediaType[]).map((key) => (
        <input
          key={key}
          type="file"
          accept={typeConfig[key].accept}
          multiple
          ref={(el) => { fileInputRefs.current[key] = el; }}
          className="hidden"
          onChange={(e) => handleFileInputChange(key, e)}
        />
      ))}

      <div className="pt-24 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          {/* Header & Case Selector */}
          <div className="reveal flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-display mb-1 flex items-center gap-3">
                Evidence Upload
                <div className="flex items-center gap-1.5 px-3 py-1 bg-sage-light/50 border border-sage text-primary rounded-full text-xs font-semibold">
                  <Lock className="w-3.5 h-3.5" />
                  AES-256 Encrypted
                </div>
              </h1>
              <p className="text-muted-foreground">
                Securely upload photos, videos, and documents specific to your case.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <FolderOpen className="w-5 h-5 text-muted-foreground" />
              <select
                className="h-10 px-3 py-2 bg-background border border-border rounded-md text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none max-w-[200px]"
                value={activeCaseId || ""}
                onChange={(e) => setActiveCaseId(e.target.value)}
              >
                {!activeCaseId && <option value="">Select a case...</option>}
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          </div>

          {!activeCaseId ? (
            <Card className="border-dashed mb-8">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">Select a case to view or upload media</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Upload zones */}
              <div className="reveal grid sm:grid-cols-3 gap-4 mb-8" style={{ transitionDelay: "100ms" }}>
                {(Object.entries(typeConfig) as [MediaType, typeof typeConfig.photo][]).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => handleUploadClick(key)}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const fileList = e.dataTransfer.files;
                        if (fileList && fileList.length > 0) {
                          Array.from(fileList).forEach((file) => handleFileUpload(file, key));
                        }
                      }}
                      className={`group relative flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed transition-all duration-200 hover:shadow-md active:scale-[0.98] ${
                        dragOver ? "border-primary bg-sage-light" : "border-border hover:border-primary/40 bg-card"
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${cfg.color} transition-transform group-hover:scale-110`}>
                        <Icon className="w-7 h-7" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-sm">{cfg.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Click or drag & drop</p>
                      </div>
                      <Upload className="w-4 h-4 text-muted-foreground absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>

              {/* Tag Selection for new uploads */}
              <Card className="reveal mb-8" style={{ transitionDelay: "150ms" }}>
                <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <h3 className="font-semibold text-sm">Default Evidence Tags</h3>
                      <p className="text-[10px] text-muted-foreground">Applied to new uploads</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {evidenceTags.map((tag) => (
                      <span
                        key={tag}
                        onClick={() => setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])}
                        className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          selectedTags.includes(tag) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Cluster Link for new uploads */}
              {clusters.length > 0 && (
                <Card className="reveal mb-8" style={{ transitionDelay: "175ms" }}>
                  <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <Link2 className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <h3 className="font-semibold text-sm">Link to Testimony Cluster</h3>
                        <p className="text-[10px] text-muted-foreground">Attach evidence to a specific cluster (optional)</p>
                      </div>
                    </div>
                    <select
                      value={selectedClusterId}
                      onChange={(e) => setSelectedClusterId(e.target.value)}
                      className="h-9 px-3 text-xs bg-background border border-border rounded-lg outline-none max-w-[300px] flex-1 focus:ring-1 focus:ring-primary"
                    >
                      <option value="">No cluster (upload only)</option>
                      {clusters.map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.cluster}] {c.content.slice(0, 50)}...
                        </option>
                      ))}
                    </select>
                  </CardContent>
                </Card>
              )}

              {/* Filter tabs + file list */}
              <div className="reveal" style={{ transitionDelay: "200ms" }}>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {[{ key: "all", label: "All Files" }, ...Object.entries(typeConfig).map(([k, v]) => ({ key: k, label: v.label }))].map((tab) => (
                    <Button
                      key={tab.key}
                      variant={activeType === tab.key ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setActiveType(tab.key as MediaType | "all")}
                    >
                      {tab.label} ({tab.key === "all" ? files.length : files.filter((f) => f.type === tab.key).length})
                    </Button>
                  ))}
                </div>

                {filtered.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                      <Upload className="w-10 h-10 text-muted-foreground mb-3" />
                      <p className="font-medium text-muted-foreground">No files in this case</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((file) => {
                      const cfg = typeConfig[file.type];
                      const Icon = cfg.icon;
                      
                      return (
                        <div
                          key={file.id}
                          className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/50 hover:shadow-sm transition-shadow group"
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                            {file.status === "uploading" ? <Upload className="w-4 h-4 animate-bounce" /> : <Icon className="w-5 h-5" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {editingFileId === file.id ? (
                                <div className="flex items-center gap-2 flex-1 max-w-[300px]">
                                  <input 
                                    className="h-7 px-2 text-sm border rounded bg-background focus:ring-1 focus:ring-primary w-full"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && saveRename(file.id)}
                                  />
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={() => saveRename(file.id)}>
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingFileId(null)}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm truncate">{file.name}</p>
                                  <button onClick={() => startRename(file.id, file.name)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-primary">
                                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 flex-wrap mt-1.5">
                              {file.tags?.map((t) => (
                                <span key={t} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-muted/80 text-muted-foreground font-medium shrink-0 group/tag">
                                  {t}
                                  <button onClick={() => removeTagFromFile(file.id, file.tags || [], t)} className="opacity-0 group-hover/tag:opacity-100 hover:text-destructive">
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                              
                              {/* Add tag inline drop menu */}
                              <div className="relative group/addtag">
                                <button className="px-1.5 py-0.5 rounded text-[10px] bg-background border border-border text-muted-foreground hover:bg-muted font-medium flex items-center gap-1">
                                  <TagIcon className="w-3 h-3" /> Add Tag
                                </button>
                                <div className="absolute top-full left-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-lg hidden group-hover/addtag:block z-10 py-1">
                                  {evidenceTags.filter(t => !file.tags?.includes(t)).map(tag => (
                                    <button 
                                      key={tag} 
                                      className="block w-full text-left px-3 py-1.5 text-xs hover:bg-muted text-muted-foreground"
                                      onClick={() => addTagToFile(file.id, file.tags || [], tag)}
                                    >
                                      {tag}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                              <span>{file.size}</span>
                              <span className="opacity-40">•</span>
                              <span>{file.timestamp}</span>
                              {file.linked_cluster_id && (
                                <>
                                  <span className="opacity-40">•</span>
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium text-[10px]">
                                    <Link2 className="w-3 h-3" />
                                    Linked to {clusters.find(c => c.id === file.linked_cluster_id)?.cluster || "cluster"}
                                  </span>
                                </>
                              )}
                            </div>

                            {file.status === "uploading" && (
                              <div className="mt-2 h-1.5 w-full rounded-full bg-secondary overflow-hidden max-w-[200px]">
                                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${file.progress}%` }} />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {file.status === "done" && file.cloudinary_url && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => window.open(file.cloudinary_url, "_blank")}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeFile(file.id, file.name)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
