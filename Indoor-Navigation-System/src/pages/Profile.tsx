import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Clock, MapPin, Heart, Settings, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Profile = () => {
  const recentTrips = [
    { from: "Andheri", to: "Ghatkopar", date: "Today, 2:30 PM", line: "Blue Line" },
    { from: "Colaba", to: "BKC", date: "Yesterday", line: "Aqua Line" },
    { from: "Versova", to: "Andheri", date: "2 days ago", line: "Blue Line" },
  ];

  const savedPlaces = [
    { name: "Home", station: "Versova", icon: "🏠" },
    { name: "Work", station: "BKC", icon: "💼" },
  ];

  const menuItems = [
    { icon: Settings, label: "Settings", badge: null },
    { icon: Heart, label: "Saved Places", badge: "2" },
    { icon: Clock, label: "Trip History", badge: null },
    { icon: MapPin, label: "Nearby Stations", badge: null },
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Profile Header */}
      <Card className="glass shadow-[var(--shadow-float)] animate-fade-in">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[hsl(var(--metro-picton))] to-[hsl(var(--metro-indigo))] flex items-center justify-center shadow-[var(--shadow-glow)]">
              <User className="h-10 w-10 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Metro Traveler</h2>
              <p className="text-muted-foreground">Regular Commuter</p>
              <Badge variant="secondary" className="mt-2">
                25 trips this month
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Saved Places */}
      <Card className="glass animate-scale-in" style={{ animationDelay: "100ms" }}>
        <CardHeader>
          <CardTitle className="text-lg">Saved Places</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {savedPlaces.map((place, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
            >
              <span className="text-3xl">{place.icon}</span>
              <div className="flex-1">
                <p className="font-medium">{place.name}</p>
                <p className="text-sm text-muted-foreground">{place.station}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          ))}
          <Button variant="secondary" className="w-full">
            Add New Place
          </Button>
        </CardContent>
      </Card>

      {/* Recent Trips */}
      <Card className="glass animate-scale-in" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Trips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentTrips.map((trip, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border border-border hover:border-secondary transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{trip.from}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">{trip.to}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{trip.date}</span>
                <Badge variant="secondary">{trip.line}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Menu Items */}
      <Card className="glass animate-scale-in" style={{ animationDelay: "300ms" }}>
        <CardContent className="p-4 space-y-2">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                className="w-full flex items-center gap-3 p-4 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-secondary" />
                </div>
                <span className="flex-1 font-medium">{item.label}</span>
                {item.badge && (
                  <Badge variant="secondary">{item.badge}</Badge>
                )}
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Button variant="hero" size="lg" className="w-full">
        Plan New Journey
      </Button>
    </div>
  );
};

export default Profile;
