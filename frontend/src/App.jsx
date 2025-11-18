import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PokerGame from './pages/PokerGame';
import BlackjackGame from './pages/BlackjackGame';
import RouletteGame from './pages/RouletteGame';
import CrapsGame from './pages/CrapsGame';
import BaccaratGame from './pages/BaccaratGame';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return user ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return user ? <Navigate to="/dashboard" /> : children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/poker/:tableId" element={<PrivateRoute><PokerGame /></PrivateRoute>} />
          <Route path="/blackjack/:tableId" element={<PrivateRoute><BlackjackGame /></PrivateRoute>} />
          <Route path="/roulette/:tableId" element={<PrivateRoute><RouletteGame /></PrivateRoute>} />
          <Route path="/craps/:tableId" element={<PrivateRoute><CrapsGame /></PrivateRoute>} />
          <Route path="/baccarat/:tableId" element={<PrivateRoute><BaccaratGame /></PrivateRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
