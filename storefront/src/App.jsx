import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Hero3D from './components/Hero3D';
import { ShoppingCart, Search, User } from 'lucide-react';

function Navbar() {
  return (
    <nav className="glass-nav">
      <div className="logo" style={{ fontSize: '1.5rem', fontWeight: 900, tracking: '-1px' }}>
        Store<span style={{ color: 'var(--accent-color)' }}>.</span>
      </div>
      <div className="nav-links" style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem', fontWeight: 600 }}>
        <span>Hardware</span>
        <span>Liquidi</span>
        <span>Accessori</span>
        <span>Novità</span>
      </div>
      <div className="nav-actions" style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-muted)' }}>
        <Search size={20} style={{ cursor: 'pointer' }} />
        <User size={20} style={{ cursor: 'pointer' }} />
        <ShoppingCart size={20} style={{ cursor: 'pointer' }} />
      </div>
    </nav>
  );
}

function Home() {
  return (
    <main>
      <Navbar />
      <Hero3D />
      <section className="spacer-section flex-center">
        <h2 className="subtitle" style={{ zIndex: 10 }}>Scorri per esplorare altro...</h2>
      </section>
    </main>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </Router>
  );
}

export default App;
