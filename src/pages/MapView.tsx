import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navigation, Toilet, Ticket, DoorOpen, Info } from "lucide-react";

const MapView = () => {
  const [selectedStation, setSelectedStation] = useState<string | null>(null);

  const metroLines = [
    { id: "line1", name: "Line 1 (Blue)", color: "hsl(var(--line-blue))", status: "Partially Operational" },
    { id: "line7", name: "Line 7 (Red)", color: "hsl(var(--line-red))", status: "Partially Operational" },
    { id: "line3", name: "Line 3 (Aqua)", color: "hsl(var(--line-aqua))", status: "Fully Underground" },
  ];

  const stations = [
    { name: "Andheri", line: "line1", facilities: ["washroom", "ticket", "exit", "interchange"] },
    { name: "Ghatkopar", line: "line1", facilities: ["washroom", "ticket", "exit"] },
    { name: "Versova", line: "line1", facilities: ["washroom", "ticket", "exit"] },
    { name: "Dahisar", line: "line7", facilities: ["washroom", "ticket", "exit"] },
    { name: "Andheri East", line: "line7", facilities: ["washroom", "ticket", "exit", "interchange"] },
    { name: "Colaba", line: "line3", facilities: ["washroom", "ticket", "exit"] },
    { name: "BKC", line: "line3", facilities: ["washroom", "ticket", "exit", "interchange"] },
    { name: "SEEPZ", line: "line3", facilities: ["washroom", "ticket", "exit"] },
  ];

  const handleStationClick = (stationName: string) => {
    setSelectedStation(stationName === selectedStation ? null : stationName);
  };

  const selectedStationData = stations.find((s) => s.name === selectedStation);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Metro Map</h2>
        <Button variant="glass" size="sm">
          <Navigation className="h-4 w-4 mr-2" />
          Location
        </Button>
      </div>

      {/* Metro Lines Legend */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Metro Lines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {metroLines.map((line) => (
            <div key={line.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full shadow-md"
                  style={{ backgroundColor: line.color }}
                />
                <span className="font-medium">{line.name}</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {line.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Interactive Map */}
      <Card className="glass">
        <CardContent className="p-6">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="line1">Blue</TabsTrigger>
              <TabsTrigger value="line7">Red</TabsTrigger>
              <TabsTrigger value="line3">Aqua</TabsTrigger>
            </TabsList>

            {["all", "line1", "line7", "line3"].map((tabValue) => (
              <TabsContent key={tabValue} value={tabValue} className="mt-6 space-y-3">
                {stations
                  .filter((station) => tabValue === "all" || station.line === tabValue)
                  .map((station) => {
                    const line = metroLines.find((l) => l.id === station.line);
                    return (
                      <div
                        key={station.name}
                        onClick={() => handleStationClick(station.name)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 hover:shadow-[var(--shadow-glow)] ${
                          selectedStation === station.name
                            ? "border-secondary bg-secondary/10 scale-105"
                            : "border-border hover:border-secondary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: line?.color }}
                            />
                            <div>
                              <h4 className="font-semibold">{station.name}</h4>
                              <p className="text-xs text-muted-foreground">{line?.name}</p>
                            </div>
                          </div>
                          <Info className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Station Details */}
      {selectedStationData && (
        <Card className="glass animate-slide-up shadow-[var(--shadow-float)]">
          <CardHeader>
            <CardTitle>{selectedStationData.name} Station</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                Available Facilities
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {selectedStationData.facilities.includes("washroom") && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                    <Toilet className="h-5 w-5 text-secondary" />
                    <span className="text-sm">Washroom</span>
                  </div>
                )}
                {selectedStationData.facilities.includes("ticket") && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                    <Ticket className="h-5 w-5 text-secondary" />
                    <span className="text-sm">Ticket Counter</span>
                  </div>
                )}
                {selectedStationData.facilities.includes("exit") && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                    <DoorOpen className="h-5 w-5 text-secondary" />
                    <span className="text-sm">Exit Gates</span>
                  </div>
                )}
                {selectedStationData.facilities.includes("interchange") && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                    <Navigation className="h-5 w-5 text-secondary" />
                    <span className="text-sm">Interchange</span>
                  </div>
                )}
              </div>
            </div>
            <Button variant="hero" className="w-full">
              Navigate to Station
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MapView;
