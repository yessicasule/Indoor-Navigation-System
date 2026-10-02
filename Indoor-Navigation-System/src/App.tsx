import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useSearchParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import { lazy, Suspense } from "react";

// Pages load on demand: someone opening an anchor link from the camera app downloads only
// the navigation screen, which matters on weak indoor mobile signal.
const Home = lazy(() => import("./pages/Home"));
const Nearby = lazy(() => import("./pages/Nearby"));
const ARNavigation = lazy(() => import("./pages/ARNavigation"));
const StudyCapture = lazy(() => import("./pages/StudyCapture"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoading = () => (
  <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground" role="status">
    Loading…
  </div>
);

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
      <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/nearby" element={<Nearby />} />
        <Route path="/ar" element={<ARRoute />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
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
