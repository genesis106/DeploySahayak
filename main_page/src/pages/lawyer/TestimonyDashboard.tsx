import { useState } from "react";
import { Search, ChevronDown, ChevronRight, MapPin, User, Calendar, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const clients = [
  {
    id: 1, name: "Priya Sharma", case: "DV-2024-0891", severity: "High", status: "Active", date: "2024-12-15",
    testimonies: [
      { id: 1, summary: "Initial testimony describing domestic violence incidents over 3 years", tags: ["Location: Mumbai", "Suspect: Husband", "Event: Physical Assault"], date: "2024-12-15" },
      { id: 2, summary: "Follow-up testimony with timeline corrections and new witness details", tags: ["Event: Threat", "Witness: Neighbor"], date: "2024-12-20" },
    ],
  },
  {
    id: 2, name: "Anjali Verma", case: "SA-2024-1102", severity: "Critical", status: "Active", date: "2024-11-28",
    testimonies: [
      { id: 1, summary: "Detailed account of workplace harassment spanning 6 months", tags: ["Location: Office", "Suspect: Manager", "Event: Harassment"], date: "2024-11-28" },
    ],
  },
  {
    id: 3, name: "Meera Patel", case: "TH-2024-0445", severity: "Medium", status: "Review", date: "2024-10-05",
    testimonies: [
      { id: 1, summary: "Testimony regarding property dispute and threats", tags: ["Location: Gujarat", "Event: Intimidation"], date: "2024-10-05" },
    ],
  },
];

const severityColor: Record<string, string> = {
  Critical: "bg-destructive/10 text-destructive border-destructive/20",
  High: "bg-gold/10 text-gold border-gold/20",
  Medium: "bg-primary/10 text-primary border-primary/20",
};

const TestimonyDashboard = () => {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(1);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.case.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Testimony Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage client testimonies and cognitive maps</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients or case numbers..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select className="px-4 py-2.5 rounded-lg bg-card border border-border text-sm text-muted-foreground focus:outline-none">
          <option>All Severity</option><option>Critical</option><option>High</option><option>Medium</option>
        </select>
        <select className="px-4 py-2.5 rounded-lg bg-card border border-border text-sm text-muted-foreground focus:outline-none">
          <option>All Status</option><option>Active</option><option>Review</option><option>Closed</option>
        </select>
      </div>

      {/* Client Cards */}
      <div className="space-y-4">
        {filtered.map((client) => (
          <div key={client.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow">
            <button onClick={() => setExpanded(expanded === client.id ? null : client.id)} className="w-full flex items-center justify-between p-5 text-left">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">{client.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{client.case}</span>
                    <span>•</span>
                    <Calendar className="w-3 h-3" /> {client.date}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={severityColor[client.severity]}>{client.severity}</Badge>
                <Badge variant="outline" className="border-primary/20 text-primary">{client.status}</Badge>
                {expanded === client.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {expanded === client.id && (
              <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
                {/* Graph placeholder */}
                <div className="bg-muted rounded-lg p-6 flex items-center justify-center border border-border">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Cognitive Map Preview</p>
                    <p className="text-xs text-muted-foreground">Graph visualization will render here</p>
                  </div>
                </div>

                {client.testimonies.map((t) => (
                  <div key={t.id} className="bg-muted/50 rounded-lg p-4 border border-border/50">
                    <p className="text-sm text-foreground mb-2">{t.summary}</p>
                    <div className="flex flex-wrap gap-2">
                      {t.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded-full bg-primary-light text-primary text-xs font-medium">{tag}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestimonyDashboard;
