import { Component, type ReactNode } from "react";

/**
 * Silent self-healing boundary: on a render crash it quietly re-mounts the
 * app (no error screen). A stale-code crash (failed chunk load) reloads once.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { key: number }> {
  state = { key: 0 };
  private crashes: number[] = [];
  componentDidCatch(err: unknown) {
    console.error("App crash recovered:", err);
    const msg = String((err as Error)?.message || err);
    if (/Loading chunk|dynamically imported module|Importing a module script/i.test(msg)) {
      if (!sessionStorage.getItem("rn_chunk_reload")) {
        sessionStorage.setItem("rn_chunk_reload", "1");
        window.location.reload();
        return;
      }
    }
    const now = Date.now();
    this.crashes = this.crashes.filter((t) => now - t < 10000).concat(now);
    if (this.crashes.length > 3) window.location.hash = "#/";
    this.setState((s) => ({ key: s.key + 1 }));
  }
  static getDerivedStateFromError() { return null; }
  render() {
    return <div key={this.state.key} className="contents">{this.props.children}</div>;
  }
}
