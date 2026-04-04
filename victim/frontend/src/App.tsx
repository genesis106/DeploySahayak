import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// IMPORT THE CASE PROVIDER HERE
import { CaseProvider } from "./contexts/CaseContext";
import { AuthProvider } from "./contexts/AuthContext";

import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import CognitiveMap from "./pages/CognitiveMap";
import GraphView from "./pages/GraphView";
import CaseInsights from "./pages/CaseInsights";
import Login from "./pages/Login";
import MediaUpload from "./pages/MediaUpload";
import Community from "./pages/Community";
import ShareViewer from "./pages/ShareViewer";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <AuthProvider>
        <CaseProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/cognitive-map" element={<CognitiveMap />} />
              <Route path="/graph" element={<GraphView />} />
              <Route path="/case-insights" element={<CaseInsights />} />
              <Route path="/community" element={<Community />} />
              <Route path="/login" element={<Login />} />
              <Route path="/media-upload" element={<MediaUpload />} />
              <Route path="/share/:token" element={<ShareViewer />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CaseProvider>
      </AuthProvider>

    </TooltipProvider>
  </QueryClientProvider>
);

export default App;