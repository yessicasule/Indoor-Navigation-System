import { Home, Map, Navigation, MapPin, User, QrCode } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/map", icon: Map, label: "Map" },
    { path: "/ar", icon: Navigation, label: "AR" },
    { path: "/nearby", icon: MapPin, label: "Nearby" },
    { path: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header with theme toggle */}
      <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-[hsl(var(--metro-picton))] to-[hsl(var(--metro-indigo))] bg-clip-text text-transparent">
            Metro Mitra
          </h1>
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-full"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          )}
        </div>
      </header>

      {/* Main content with top padding for fixed header */}
      <main className="pt-16">{children}</main>

      {/* Floating QR Scan Button */}
      <Link to="/ar">
        <Button
          size="icon"
          variant="floating"
          className="fixed bottom-24 right-6 z-50 h-16 w-16 shadow-2xl"
        >
          <QrCode className="h-7 w-7" />
        </Button>
      </Link>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/50">
        <div className="container mx-auto px-2">
          <div className="flex items-center justify-around h-20">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex flex-col items-center justify-center flex-1 h-full group"
                >
                  <div
                    className={`flex flex-col items-center transition-all duration-300 ${
                      isActive
                        ? "text-secondary scale-110"
                        : "text-muted-foreground group-hover:text-foreground group-hover:scale-105"
                    }`}
                  >
                    <Icon className="h-6 w-6 mb-1" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </div>
                  {isActive && (
                    <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-12 h-1 bg-secondary rounded-b-full animate-slide-up" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Layout;
