import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Camera, Navigation, ArrowRight, MapPin, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ARGuidance = () => {
  const [arActive, setArActive] = useState(false);

  const directions = [
    { icon: ArrowRight, text: "Exit Gate 2 →", distance: "50m" },
    { icon: MapPin, text: "Platform 1 for Line 2A", distance: "120m" },
  ];

  return (
    <div className="min-h-screen">
      {/* AR Camera View */}
      <div className="relative h-[60vh] bg-gradient-to-br from-[hsl(var(--metro-indigo))] to-[hsl(var(--metro-picton))] overflow-hidden">
        {arActive ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4 animate-pulse">
              <Camera className="h-20 w-20 mx-auto text-white/80" />
              <p className="text-white text-lg">AR Camera Active</p>
              <p className="text-white/70 text-sm">Point camera at QR codes</p>
            </div>

            {/* AR Direction Overlays */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="bg-secondary/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-[var(--shadow-glow)] animate-float">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5" />
                  <span className="font-semibold">Exit Gate 2</span>
                  <Badge variant="secondary" className="bg-white text-primary">
                    50m
                  </Badge>
                </div>
              </div>
            </div>

            <div className="absolute bottom-1/3 right-8">
              <div className="bg-accent/90 backdrop-blur-md text-white px-5 py-2 rounded-full shadow-lg animate-float" style={{ animationDelay: "1s" }}>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm">Platform 1</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white">
            <QrCode className="h-24 w-24 mb-6 animate-pulse-glow" />
            <h2 className="text-3xl font-bold mb-3">AR Navigation</h2>
            <p className="text-white/80 mb-8 max-w-sm">
              Scan QR codes at the station to activate augmented reality guidance
            </p>
            <Button
              variant="hero"
              size="xl"
              onClick={() => setArActive(true)}
              className="bg-white text-primary hover:bg-white/90"
            >
              <Camera className="mr-2 h-5 w-5" />
              Activate AR Camera
            </Button>
          </div>
        )}
      </div>

      {/* Controls and Information */}
      <div className="container mx-auto px-4 py-6 space-y-4">
        {arActive ? (
          <>
            <Card className="glass shadow-[var(--shadow-float)] animate-slide-up">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Active Directions</h3>
                  <Badge variant="secondary">Live</Badge>
                </div>
                <div className="space-y-3">
                  {directions.map((direction, index) => {
                    const Icon = direction.icon;
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{direction.text}</p>
                          <p className="text-xs text-muted-foreground">
                            {direction.distance} ahead
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setArActive(false)}
            >
              Stop AR Navigation
            </Button>
          </>
        ) : (
          <>
            <Card className="glass">
              <CardHeader className="flex flex-row items-start gap-4 p-6">
                <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Info className="h-6 w-6 text-secondary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">How AR Navigation Works</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-secondary">•</span>
                      <span>Scan QR codes placed throughout the station</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-secondary">•</span>
                      <span>Follow AR arrows and markers on your screen</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-secondary">•</span>
                      <span>
                        Get real-time directions to exits, platforms, and facilities
                      </span>
                    </li>
                  </ul>
                </div>
              </CardHeader>
            </Card>

            <Card className="glass">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3">Common Destinations</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: MapPin, label: "Platforms" },
                    { icon: Navigation, label: "Exit Gates" },
                    { icon: QrCode, label: "Ticket Counter" },
                    { icon: Camera, label: "Facilities" },
                  ].map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={index}
                        className="p-4 rounded-lg border border-border hover:border-secondary transition-colors cursor-pointer text-center space-y-2"
                      >
                        <Icon className="h-6 w-6 mx-auto text-secondary" />
                        <p className="text-sm font-medium">{item.label}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default ARGuidance;
