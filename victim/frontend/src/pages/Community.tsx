import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, MessageCircle, Users, Shield, BookOpen, Scale, HandHeart, Send, ThumbsUp, Star, Info, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const API_BASE = "http://localhost:8000/api/community";

const categories = [
  { id: "all", label: "All Stories", icon: BookOpen },
  { id: "domestic", label: "Domestic Violence", icon: Shield },
  { id: "workplace", label: "Workplace Harassment", icon: Scale },
  { id: "cyber", label: "Sexual Assault", icon: Users },
  { id: "stalking", label: "Cyber Stalking", icon: Shield },
  { id: "recovery", label: "Mental Health", icon: HandHeart },
];

export default function Community() {
  const [activeTab, setActiveTab] = useState("all");
  const [mainTab, setMainTab] = useState("stories");
  const [stories, setStories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shareText, setShareText] = useState("");

  const fetchStories = async (category: string) => {
    setIsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/stories?category=${category}`);
      const data = await resp.json();
      setStories(data);
    } catch (err) {
      console.error("Failed to fetch stories:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStories(activeTab);
  }, [activeTab]);

  const handleLike = async (id: string) => {
    try {
      const resp = await fetch(`${API_BASE}/stories/${id}/like`, { method: "POST" });
      const updated = await resp.json();
      setStories(prev => prev.map(s => s.id === id ? updated : s));
      toast.success("Marked as helpful");
    } catch (err) {
      toast.error("Failed to update");
    }
  };

  const handleShare = async () => {
    if (!shareText.trim()) return;
    try {
      const resp = await fetch(`${API_BASE}/stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "My Journey",
          fullStory: shareText,
          category: activeTab === "all" ? "recovery" : activeTab,
          categoryLabel: categories.find(c => c.id === activeTab)?.label || "Survivor Story",
          tags: ["Shared"]
        })
      });
      const created = await resp.json();
      setStories([created, ...stories]);
      setShareText("");
      toast.success("Story shared anonymously");
    } catch (err) {
      toast.error("Failed to share story");
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] pt-24 pb-12">
      <Navbar />
      <div className="container mx-auto px-6 max-w-4xl">
        
        {/* Header Section */}
        <div className="flex items-start gap-5 mb-10">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-semibold tracking-tight text-[#1A1A1A]">Survivor Community</h1>
            <p className="text-sm text-muted-foreground mt-1 mb-3">Anonymous • Safe • Moderated</p>
            <p className="text-[#4A4A4A] text-[15px] leading-relaxed max-w-2xl">
              You are not alone. Read journeys of women who fought back, find advice on legal rights, mental health resources, and connect with survivors who understand your path.
            </p>
          </div>
        </div>

        {/* Main Tabs (Stories / Resources) */}
        <Tabs defaultValue="stories" value={mainTab} onValueChange={setMainTab} className="mb-8">
          <TabsList className="bg-[#F1F5F9] p-1 h-11">
            <TabsTrigger value="stories" className="px-6 gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <BookOpen className="w-4 h-4" /> Stories
            </TabsTrigger>
            <TabsTrigger value="resources" className="px-6 gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Shield className="w-4 h-4" /> Resources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stories" className="mt-8 space-y-8 outline-none">
            
            {/* Category Filters */}
            <div className="flex flex-wrap gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[14px] transition-all
                    ${activeTab === cat.id 
                      ? "bg-[#2D6A4F] border-[#2D6A4F] text-white shadow-md shadow-[#2D6A4F]/20" 
                      : "bg-white border-border/80 text-muted-foreground hover:border-[#2D6A4F]/30 hover:text-[#2D6A4F]"}`}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Share Box */}
            <Card className="border-dashed bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <p className="text-sm font-medium mb-3">Share your journey anonymously</p>
                <div className="relative">
                    <Textarea 
                      placeholder="Your story can give someone the courage to take the first step..."
                      className="min-h-[120px] bg-white border-primary/10 focus-visible:ring-primary/20 resize-none text-[15px] p-4"
                      value={shareText}
                      onChange={(e) => setShareText(e.target.value)}
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                        <p className="text-[11px] text-muted-foreground mr-2">Your identity is never revealed. All posts are moderated for safety.</p>
                        <Button size="sm" className="bg-[#87A2A3] hover:bg-[#6B8E8F] gap-2" onClick={handleShare}>
                            <Send className="w-4 h-4" /> Share
                        </Button>
                    </div>
                </div>
              </CardContent>
            </Card>

            {/* Stories List */}
            <div className="space-y-6">
              {isLoading ? (
                <div className="py-20 text-center text-muted-foreground italic">Gently loading stories...</div>
              ) : stories.length === 0 ? (
                <div className="py-20 text-center bg-[#F8FAFC] border border-dashed rounded-xl">
                  <p className="text-muted-foreground">No stories in this category yet.</p>
                </div>
              ) : (
                stories.map((story) => (
                  <StoryCard key={story.id} story={story} onLike={() => handleLike(story.id)} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="resources" className="mt-8 space-y-6 outline-none">
             <div className="grid md:grid-cols-2 gap-6">
                {[
                    { title: "Legal Rights Guide", desc: "Understanding BNS sections for domestic and workplace protection.", icon: Scale },
                    { title: "Emergency Help", desc: "Direct contacts for women's helplines and safe houses.", icon: Shield },
                    { title: "Mental Well-being", desc: "Connect with trauma-informed counselors and support groups.", icon: HandHeart },
                    { title: "One Stop Centers", icon: Home, desc: "Integrated services for medical, legal, and psychological aid." }
                ].map((item, i) => (
                    <Card key={i} className="hover:shadow-md transition-shadow cursor-pointer group">
                        <CardHeader className="flex flex-row items-center gap-4 pb-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                <item.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">{item.title}</CardTitle>
                                <CardDescription className="text-xs">Available 24/7</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                        </CardContent>
                    </Card>
                ))}
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Home({ className }) { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }

function StoryCard({ story, onLike }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-[#E2E8F0] shadow-none hover:shadow-sm transition-all duration-300">
      <CardHeader className="pb-4 flex flex-row items-start justify-between">
        <div className="flex gap-3">
          <Avatar className="w-10 h-10 bg-[#F1F5F9] border-none">
            <AvatarFallback className="bg-[#DDE5ED] text-[#4A5568] text-xs font-bold">{story.avatar}</AvatarFallback>
          </Avatar>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[14px] text-[#2D3748]">{story.alias}</span>
              {story.verified && (
                <div className="flex items-center gap-1 border rounded-md px-1.5 py-0.5 bg-white text-[10px] text-muted-foreground font-medium">
                   <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" /> Verified
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#718096] font-medium">{story.timeAgo}</span>
                <span className="text-[11px] text-[#A0AEC0]">•</span>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-[#F8FAFC] text-[#4A5568] font-normal rounded-md border-[#E2E8F0]">
                    {story.categoryLabel}
                </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardTitle className="text-xl text-[#2D3748] font-bold leading-tight">{story.title}</CardTitle>
        <div className="text-[#4A5568] text-[15px] leading-relaxed whitespace-pre-wrap">
          {expanded ? (
            <div className="space-y-4">
              {story.fullStory.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          ) : story.excerpt}
        </div>
        
        <div className="flex flex-wrap gap-2 pt-1">
          {story.tags.map((tag, i) => (
            <Badge key={i} variant="secondary" className="font-normal text-[11px] bg-[#F1F5F9] text-[#718096] border-none hover:bg-[#E2E8F0]">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between pt-5 mt-2 border-t border-[#F1F5F9]">
           <div className="flex items-center gap-6">
             <button onClick={onLike} className="flex items-center gap-2 text-[13px] text-[#718096] hover:text-red-500 transition-colors group">
                <Heart className={`w-[18px] h-[18px] ${story.likes > 100 ? 'fill-red-500 text-red-500' : 'group-hover:fill-red-500'}`} />
                <span>{story.likes}</span>
             </button>
             <div className="flex items-center gap-2 text-[13px] text-[#718096]">
                <MessageCircle className="w-[18px] h-[18px]" />
                <span>{story.replies} replies</span>
             </div>
           </div>
           <div className="flex items-center gap-4">
               <button className="flex items-center gap-2 text-[13px] text-[#718096] hover:text-primary transition-colors">
                  <ThumbsUp className="w-[18px] h-[18px]" />
                  <span>Helpful</span>
               </button>
               <button 
                  className="text-primary text-xs font-semibold hover:underline"
                  onClick={() => setExpanded(!expanded)}
               >
                 {expanded ? "Show less" : "Read full story →"}
               </button>
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
