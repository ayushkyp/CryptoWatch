import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import AssetDetail from './pages/AssetDetail';
import Watchlist from './pages/Watchlist';
import Alerts from './pages/Alerts';
import Login from './pages/Login';
import Register from './pages/Register';
import GlobalAlertNotifier from './components/ui/GlobalAlertNotifier';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
};

const AppLayout = ({ children }) => (
  <div className="min-h-screen bg-[#0f0f1a] flex flex-col">
    <Navbar />
    <div className="flex flex-1">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  </div>
);

const AppRoutes = () => (
  <Routes>
    <Route
      path="/"
      element={
        <ProtectedRoute>
          <AppLayout><Dashboard /></AppLayout>
        </ProtectedRoute>
      }
    />
    <Route
      path="/coin/:symbol"
      element={
        <ProtectedRoute>
          <AppLayout><AssetDetail /></AppLayout>
        </ProtectedRoute>
      }
    />
    <Route
      path="/watchlist"
      element={
        <ProtectedRoute>
          <AppLayout><Watchlist /></AppLayout>
        </ProtectedRoute>
      }
    />
    <Route
      path="/alerts"
      element={
        <ProtectedRoute>
          <AppLayout><Alerts /></AppLayout>
        </ProtectedRoute>
      }
    />
    <Route
      path="/login"
      element={<PublicRoute><Login /></PublicRoute>}
    />
    <Route
      path="/register"
      element={<PublicRoute><Register /></PublicRoute>}
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <SocketProvider>
        <Router>
          <GlobalAlertNotifier />
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1a1a2e',
                color: '#f1f5f9',
                border: '1px solid #2a2a4a',
                borderRadius: '12px',
              },
            }}
          />
        </Router>
      </SocketProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
