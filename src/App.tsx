import { Link, Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Callback from "./pages/Callback";
import { env } from "./config/env";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          Pellerex Managed App
        </Link>
        <nav>
          <Link to="/">Home</Link>
          {/* A client-side deep link — nginx try_files falls back to index.html (WA-R8). */}
          <Link to="/dashboard">Dashboard</Link>
        </nav>
        <span className="env-badge">{env.environment}</span>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/callback" element={<Callback />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="app-footer">
        Served anonymously through ProxyApi · build once, run everywhere
      </footer>
    </div>
  );
}
