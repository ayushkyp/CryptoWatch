import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import useSocket from '../../hooks/useSocket';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { path: '/', label: 'Dashboard' },
    { path: '/watchlist', label: 'Watchlist' },
    { path: '/alerts', label: 'Alerts' },
  ];

  return (
    <nav className="bg-[#1a1a2e] border-b border-[#2a2a4a] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2">
        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          CryptoWatch
        </span>
      </Link>

      {/* Nav Links */}
      <div className="hidden md:flex items-center gap-1">
        {navLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              location.pathname === link.path
                ? 'bg-[#2a2a4a] text-white'
                : 'text-slate-400 hover:text-white hover:bg-[#2a2a4a]'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
            title={connected ? 'Live' : 'Disconnected'}
          />
          <span className="text-xs text-slate-400 hidden md:block">
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="bg-[#2a2a4a] text-slate-300 px-3 py-2 rounded-xl hover:bg-[#3a3a5a] transition text-sm"
        >
          {isDark ? '☀️' : '🌙'}
        </button>

        {/* User email */}
        {user && (
          <span className="text-sm text-slate-400 hidden md:block">{user.email}</span>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="bg-[#2a2a4a] text-slate-300 px-4 py-2 rounded-xl hover:bg-[#3a3a5a] transition text-sm"
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
