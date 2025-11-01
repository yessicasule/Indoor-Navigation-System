import { TrainFront, QrCode, MapPin, Clock } from "lucide-react";
// We removed 'Search' and 'Input' as they are now in RoutePlanner
// We also removed 'useState' as it's also handled in RoutePlanner

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
// FIX: Changed path aliases to relative paths
import heroImage from "../assets/hero-metro.jpg";
import mumbaiSkyline from "../assets/mumbai-skyline.jpg";

// --- THIS IS OUR NEW COMPONENT ---
// FIX: Changed path aliases to relative paths
import RoutePlanner from "../components/RoutePlanner";

const Home = () => {
  // We've removed the [source, setSource] and [destination, setDestination] state
  // It is now managed inside the RoutePlanner component.

  // --- THIS IS THE UPDATED 'quickActions' ARRAY ---
  // "Plan Route" is now "Find Trains"
  const quickActions = [
    { icon: QrCode, label: "Scan QR", path: "/ar", variant: "hero" as const },
    {
      icon: TrainFront, // New Icon
      label: "Find Trains", // New Label
      path: "/timings", // New Path (for later)
      variant: "secondary" as const,
    },
    {
      icon: MapPin,
      label: "Nearby Spots",
      path: "/nearby",
      variant: "secondary" as const,
    },
    {
      icon: Clock,
      label: "My Trips",
      path: "/profile",
      variant: "secondary" as const,
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section (No changes here) */}
      <section className="relative h-[40vh] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Mumbai Metro Station"
            className="w-full h-full object-cover"
            // FIX: Removed the stray '*' before onError
            onError={(e) => { e.currentTarget.src = 'https://placehold.co/1920x480/003366/FFFFFF?text=Metro+Mitra'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
        </div>
        <div className="relative z-10 container mx-auto px-4 h-full flex flex-col justify-end pb-8">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-2 animate-fade-in">
            Navigate Mumbai
          </h2>
          <p className="text-lg text-muted-foreground animate-fade-in">
            Your intelligent metro companion
          </p>
        </div>
      </section>

      {/* --- THIS IS THE UPDATED SECTION --- */}
      {/* We are replacing your old 'Search Section' with our new component */}
      <section className="container mx-auto px-4 -mt-8 relative z-20 animate-slide-up">
        {/* This <RoutePlanner /> component now contains the full 3-part planner */}
        <RoutePlanner />
      </section>

      {/* Quick Actions (This section is now updated via the array above) */}
      <section className="container mx-auto px-4 mt-8">
        <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link key={action.label} to={action.path}>
                <Card
                  className="hover:shadow-[var(--shadow-glow)] transition-all duration-300 hover:-translate-y-1 animate-scale-in cursor-pointer"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                    <div
                      className={`h-14 w-14 rounded-full ${
                        action.variant === "hero"
                          ? "bg-gradient-to-br from-[hsl(var(--metro-picton))] to-[hsl(var(--metro-indigo))]"
                          : "bg-secondary"
                      } flex items-center justify-center`}
                    >
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <span className="font-medium">{action.label}</span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Features Section (No changes here) */}
      <section className="container mx-auto px-4 mt-8 mb-8">
        <Card className="overflow-hidden">
          <div className="relative h-48">
            <img
              src={mumbaiSkyline}
              alt="Mumbai Skyline"
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.src = 'https://placehold.co/600x400/333/FFF?text=Mumbai+Skyline'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="text-2xl font-bold text-foreground mb-2">
                Explore Mumbai
              </h3>
              <p className="text-muted-foreground text-sm">
                Discover attractions near every metro station
              </p>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-secondary">3+</div>
                <div className="text-xs text-muted-foreground">Metro Lines</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-secondary">50+</div>
                <div className="text-xs text-muted-foreground">Stations</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-secondary">100+</div>
                <div className="text-xs text-muted-foreground">Attractions</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Home;

