import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useSearchParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import MapView from "./pages/MapView";
import Nearby from "./pages/Nearby";
import ARNavigation from "./pages/ARNavigation";
import StudyCapture from "./pages/StudyCapture";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// /ar?study=1 is the Study 1 magnetic-survey capture mode; plain /ar is navigation.
const ARRoute = () => {
  const [params] = useSearchParams();
  return params.get("study") === "1" ? <StudyCapture /> : <ARNavigation />;
};

const AppRoutes = () => {
  const location = useLocation();
  return (
    // Keyed on the path so navigating away from a crashed page clears the error.
    <ErrorBoundary key={location.pathname}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/nearby" element={<Nearby />} />
        <Route path="/ar" element={<ARRoute />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Layout>
            <AppRoutes />
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
