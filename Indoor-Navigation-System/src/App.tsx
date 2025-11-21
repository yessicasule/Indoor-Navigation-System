import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import MapView from "./pages/MapView";
import Nearby from "./pages/Nearby";
import ARGuidance from "./pages/ARGuidance";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import TestAR from "./pages/ARtestMihit";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/nearby" element={<Nearby />} />
              <Route path="/ar" element={<ARGuidance />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/ARtest" element={<TestAR />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
