import { useState } from "react";
import { Home, Search, X, FolderOpen, Bell, Users, Radio, ArrowDownCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppLogo } from "@/components/brand/AppLogo";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/** Full-width Spotify-style top bar: logo, round Home button, pill search, account actions. */
export function DesktopTopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const onHome = location.pathname === "/home" || location.pathname === "/";

  const submit = (value: string) => {
    sessionStorage.setItem("rn_pending_q", value);
    window.dispatchEvent(new CustomEvent("rn-search", { detail: value }));
    if (location.pathname !== "/search") navigate("/search");
  };

  const initial = (user?.email || "R").charAt(0).toUpperCase();

  return (
    <header className="hidden h-16 shrink-0 items-center gap-2 px-4 lg:flex">
      <AppLogo className="h-9 w-9 rounded-full" />
      <div className="flex flex-1 items-center justify-center gap-2">
        <button
          onClick={() => navigate("/home")}
          aria-label="Home"
          className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary transition-transform hover:scale-105", onHome ? "text-foreground" : "text-muted-foreground")}
        >
          <Home className="h-6 w-6" fill={onHome ? "currentColor" : "none"} />
        </button>
        <div className="flex h-12 w-full max-w-[480px] items-center gap-3 rounded-full bg-secondary px-4 ring-foreground/20 transition-shadow focus-within:ring-2 hover:bg-muted">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); submit(e.target.value); }}
            onFocus={() => location.pathname !== "/search" && navigate("/search")}
            placeholder="What do you want to play?"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button onClick={() => { setQ(""); submit(""); }} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          )}
          <span className="h-6 w-px bg-border" />
          <button onClick={() => navigate("/browse")} aria-label="Browse" className="text-muted-foreground hover:text-foreground">
            <FolderOpen className="h-5 w-5" />
          </button>
        </div>
        <button onClick={() => navigate("/radio")} aria-label="Radio" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-transform hover:scale-105 hover:text-foreground">
          <Radio className="h-5 w-5" />
        </button>
      </div>
      <button onClick={() => navigate("/premium")} className="hidden h-8 rounded-full bg-foreground px-4 text-sm font-bold text-background transition-transform hover:scale-105 xl:block">
        Explore Premium
      </button>
      <button onClick={() => navigate("/settings")} className="hidden items-center gap-1.5 px-2 text-sm font-bold text-muted-foreground hover:text-foreground xl:flex">
        <ArrowDownCircle className="h-4 w-4" /> Install App
      </button>
      <button aria-label="What's new" className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"><Bell className="h-5 w-5" /></button>
      <button aria-label="Friend activity" className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"><Users className="h-5 w-5" /></button>
      <button
        onClick={() => navigate(user ? "/profile" : "/auth")}
        aria-label="Profile"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{initial}</span>
      </button>
    </header>
  );
}
