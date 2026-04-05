import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, Printer, Shield, Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const TEMPLATES = {
  FIR: "FIRST INFORMATION REPORT\n(Under Section 154 Cr.P.C.)\n\n1. District: [DISTRICT] | P.S: [POLICE STATION] | Year: 2024\n2. Acts & Sections: [SECTIONS]\n3. Occurrence of Offence: [DATE/TIME]\n4. Information received at P.S. Date: [DATE]\n\nComplainant Details:\nName: [COMPLAINANT NAME]\nAddress: [ADDRESS]\n\nDetails of known/suspected/unknown accused:\n[ACCUSED DETAILS OR 'UNKNOWN']\n\nReasons for delay in reporting:\n[N/A OR REASONS]\n\nParticulars of properties involved/stolen:\n[DETAILS]\n\nBrief Summary of Facts:\n[INSERT RELEVANT TESTIMONY SUMMARY HERE]",
  LEGAL_NOTICE: "LEGAL NOTICE\n\nBy Registered Post with A/D\n\nDated: [CURRENT DATE]\n\nTo,\n[NAME OF RECIPIENT]\n[ADDRESS OF RECIPIENT]\n\nSubject: Legal notice for [SUBJECT MATTER].\n\nSir/Madam,\n\nUnder instructions from and on behalf of my client [CLIENT NAME], resident of [CLIENT ADDRESS], I hereby serve upon you the following legal notice:\n\n1. That my client states [FACT 1].\n2. That despite multiple requests, you have failed to [ACTION REQ].\n3. That your actions amount to [LEGAL VIOLATION].\n\nI therefore, by means of this notice, call upon you to [DEMAND] within 15 days of receipt of this notice, failing which my client shall be constrained to initiate civil/criminal proceedings against you at your cost and risk.\n\nYours faithfully,\n\nAdvocate\n[ADVOCATE DETAILS]",
  CHARGESHEET: "DRAFT OF CHARGESHEET\n\nDated: [CURRENT DATE]\n\nTo,\n[ACCUSED NAME/DESIGNATION]\n[ACCUSED ADDRESS]\n\nSUBJECT: CHARGESHEET FOR MISCONDUCT / OFFENCE\n\nSir/Madam,\n\n[COMPLAINANT/AUTHORITY] has made a written complaint against you. The contents of the allegations and wrong acts brought to our notice are as under:\n\n[INSERT SPECIFIC CHARGES AND FACTS HERE]\n\nThe above acts constitute serious misconduct and offence under applicable laws.\n\nAfter going through all allegations carefully, you are called upon to submit your written explanation within Seven (7) days from the receipt of this letter as to why disciplinary/legal action should not be taken against you.\n\nPlease note that if you fail to give your explanation within the stipulated time, it shall be presumed that the charges are accepted by you and appropriate action shall be taken ex-parte.\n\nYours faithfully,\n\n[SIGNATURE AUTHORITY]",
  WRITTEN_ARGUMENTS: "IN THE COURT OF [COURT NAME], [CITY]\n\nCASE NO. [CASE NUMBER] OF [YEAR]\n\nBETWEEN:\n[CLIENT NAME] ... PETITIONER/COMPLAINANT\n\nAND\n[OPPOSING PARTY] ... RESPONDENT/ACCUSED\n\nWRITTEN ARGUMENTS ON BEHALF OF THE [PARTY]\n\nMAY IT PLEASE THIS HON'BLE COURT:\n\n1. BRIEF FACTS OF THE CASE:\n[SUMMARIZE THE CASE FACTS FROM TESTIMONIES]\n\n2. ISSUES TO BE DETERMINED:\n[OUTLINE LEGAL ISSUES]\n\n3. SUBMISSIONS AND ARGUMENTS:\n[ARGUMENT 1]\n[ARGUMENT 2]\n\n4. PRAYER:\nIn light of the above facts, circumstances, and arguments, it is most respectfully prayed that this Hon'ble Court may be pleased to [RELIEF SOUGHT], in the interest of justice and equity.\n\nDated at [CITY] on this [DAY] day of [MONTH], [YEAR].\n\nAdvocate for the [PARTY]\n[ADVOCATE NAME]"
};

export default function DocumentGenerator() {
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [docType, setDocType] = useState<"FIR" | "LEGAL_NOTICE" | "CHARGESHEET" | "WRITTEN_ARGUMENTS">("FIR");
  const [documentContent, setDocumentContent] = useState<string>("");

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

  const [loadingDoc, setLoadingDoc] = useState(false);

  // Auto-generate AI document on selection
  useEffect(() => {
    if (!selectedCaseId) return;
    
    setLoadingDoc(true);
    setDocumentContent("");
    
    fetch(`${API_BASE_URL}/lawyer/generate-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: selectedCaseId, doc_type: docType })
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed Network Response");
        return res.json();
      })
      .then((data) => {
        if (data.status === "success") {
          setDocumentContent(data.text);
        } else {
          toast({ title: "Generation Failed", description: data.detail, variant: "destructive" });
        }
      })
      .catch((err) => {
        console.error("AI Generation Error:", err);
        toast({ title: "Failed to request AI generation", variant: "destructive" });
      })
      .finally(() => setLoadingDoc(false));
  }, [selectedCaseId, docType, toast]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([documentContent], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${docType.toLowerCase()}_${selectedCaseId?.substring(0,8)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast({ title: "Document downloaded locally" });
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-3xl font-display font-semibold text-foreground">Document Generator</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate and edit formal court-ready legal documents synchronized with case data.</p>
      </div>

      {loadingCases ? (
        <div className="py-20 flex flex-col items-center justify-center opacity-50">
           <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
           <p className="text-sm">Fetching legal cases...</p>
        </div>
      ) : clients.length === 0 ? (
         <div className="py-20 text-center border rounded-xl bg-card border-border border-dashed text-muted-foreground">
            No active cases found in the MongoDB database.
         </div>
      ) : (
        <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
          
          {/* Sidebar / Client Select (Hidden in Print) */}
          <div className="space-y-6 print:hidden">
            <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Select Client</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {clients.map((client) => {
                    const isActive = selectedCaseId === client.id;
                    return (
                    <button
                        key={client.id}
                        onClick={() => setSelectedCaseId(client.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
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

            <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Document Type</h3>
                <div className="space-y-2">
                    <Button 
                        variant={docType === "FIR" ? "default" : "outline"} 
                        className="w-full justify-start"
                        onClick={() => setDocType("FIR")}
                    >FIR Format</Button>
                    <Button 
                        variant={docType === "LEGAL_NOTICE" ? "default" : "outline"} 
                        className="w-full justify-start"
                        onClick={() => setDocType("LEGAL_NOTICE")}
                    >Legal Notice</Button>
                    <Button 
                        variant={docType === "CHARGESHEET" ? "default" : "outline"} 
                        className="w-full justify-start"
                        onClick={() => setDocType("CHARGESHEET")}
                    >Chargesheet Draft</Button>
                    <Button 
                        variant={docType === "WRITTEN_ARGUMENTS" ? "default" : "outline"} 
                        className="w-full justify-start"
                        onClick={() => setDocType("WRITTEN_ARGUMENTS")}
                    >Written Arguments</Button>
                </div>
            </div>
          </div>

          {/* Document Editor */}
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm flex flex-col print:shadow-none print:border-none">
            {/* Toolbar (Hidden in Print) */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/30 print:hidden">
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                <FileText className="w-4 h-4" /> {docType.replace("_", " ")} — Case {selectedCaseId?.substring(0,8).toUpperCase()}-2024
                </div>
                <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" /> Print</Button>
                <Button variant="outline" size="sm" onClick={handleDownload}><Download className="w-4 h-4 mr-1" /> Download .txt</Button>
                <Button variant="hero" size="sm" onClick={() => toast({title: "Saved draft securely to Document Vault!"})}><Save className="w-4 h-4 mr-1" /> Save Draft</Button>
                </div>
            </div>

            {/* Document Actual Content Area */}
            <div className="p-8 md:p-12 max-w-[800px] mx-auto w-full bg-white text-black min-h-[850px] print:p-0 print:m-0 print:w-full">
                {/* Formal Header (Emblem of India mockup) */}
                <div className="text-center pb-6 mb-6">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-300">
                    <Shield className="w-8 h-8 text-slate-800" />
                </div>
                <h2 className="text-lg font-serif font-bold text-slate-900 uppercase tracking-widest">{docType.replace("_", " ")}</h2>
                <p className="text-xs text-slate-600 font-serif mt-1">Formulated under active jurisdiction</p>
                </div>

                {loadingDoc ? (
                    <div className="w-full h-[500px] flex flex-col items-center justify-center text-muted-foreground">
                        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                        <p className="text-sm font-medium">Sahayak AI is drafting your {docType.replace("_", " ")}...</p>
                        <p className="text-xs opacity-75 mt-1 text-center max-w-[300px]">Extracting clusters, mapping to BNS 2023, and formatting legally.</p>
                    </div>
                ) : (
                    <textarea 
                        value={documentContent}
                        onChange={(e) => setDocumentContent(e.target.value)}
                        className="w-full h-[600px] bg-transparent resize-none outline-none font-serif text-sm leading-relaxed text-slate-900 whitespace-pre-wrap selection:bg-slate-200 print:h-auto print:overflow-visible"
                        spellCheck="false"
                    />
                )}

                <div className="border-t border-slate-200 mt-10 pt-6 flex justify-between text-xs text-slate-500 font-serif print:mt-4">
                    <span>Generated by Sahayak Agent Framework • {new Date().toLocaleDateString('en-IN')}</span>
                    <span>Document ID: {selectedCaseId?.substring(0,8).toUpperCase()}</span>
                </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
