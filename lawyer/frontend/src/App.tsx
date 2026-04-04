import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LawyerLayout from "./components/lawyer/LawyerLayout";
import TestimonyDashboard from "./pages/lawyer/TestimonyDashboard";
import AIQuery from "./pages/lawyer/AIQuery";
import DocumentGenerator from "./pages/lawyer/DocumentGenerator";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LawyerLayout />}>
            <Route index element={<Navigate to="/testimony" replace />} />
            <Route path="testimony" element={<TestimonyDashboard />} />
            <Route path="ai-query" element={<AIQuery />} />
            <Route path="documents" element={<DocumentGenerator />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
