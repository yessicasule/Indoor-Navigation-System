import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Clock } from "lucide-react";
import juhuBeach from "@/assets/juhu-beach.jpg";
import iskconTemple from "@/assets/iskcon-temple.jpg";
import gatewayIndia from "@/assets/gateway-india.jpg";
import marineDrive from "@/assets/marine-drive.jpg";

const Nearby = () => {
  const attractions = [
    {
      name: "Juhu Beach",
      station: "Versova",
      distance: "3.5 km",
      duration: "15 min",
      image: juhuBeach,
      description: "Popular beach destination with street food and sunset views",
      category: "Beach",
    },
    {
      name: "ISKCON Temple",
      station: "Andheri",
      distance: "2.0 km",
      duration: "8 min",
      image: iskconTemple,
      description: "Spiritual landmark with beautiful architecture and peaceful atmosphere",
      category: "Temple",
    },
    {
      name: "Gateway of India",
      station: "Colaba",
      distance: "1.2 km",
      duration: "5 min",
      image: gatewayIndia,
      description: "Iconic monument overlooking the Arabian Sea with boat rides",
      category: "Monument",
    },
    {
      name: "Marine Drive",
      station: "Churchgate",
      distance: "0.8 km",
      duration: "3 min",
      image: marineDrive,
      description: "The Queen's Necklace - scenic coastal road perfect for evening walks",
      category: "Scenic",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Nearby Attractions</h2>
        <p className="text-muted-foreground">
          Discover popular spots near metro stations
        </p>
      </div>

      <div className="space-y-4">
        {attractions.map((attraction, index) => (
          <Card
            key={attraction.name}
            className="overflow-hidden hover:shadow-[var(--shadow-glow)] transition-all duration-300 hover:-translate-y-1 animate-scale-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="relative h-48 overflow-hidden">
              <img
                src={attraction.image}
                alt={attraction.name}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <Badge className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm">
                {attraction.category}
              </Badge>
            </div>

            <CardHeader>
              <CardTitle className="text-xl">{attraction.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {attraction.description}
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{attraction.distance} away</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{attraction.duration} drive</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Navigation className="h-4 w-4 text-secondary" />
                <div className="flex-1">
                  <span className="text-xs text-muted-foreground">Nearest Station</span>
                  <p className="text-sm font-medium">{attraction.station}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" className="w-full">
                  View on Map
                </Button>
                <Button variant="hero" className="w-full">
                  Get Directions
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass">
        <CardContent className="p-6 text-center space-y-3">
          <h3 className="font-semibold">Discover More</h3>
          <p className="text-sm text-muted-foreground">
            Explore 100+ attractions across Mumbai Metro network
          </p>
          <Button variant="hero" size="lg" className="w-full">
            Browse All Attractions
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Nearby;
