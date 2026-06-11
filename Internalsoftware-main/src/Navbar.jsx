import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "./assets/logo.png";
import "./form.css";
import { getAuth, signOut } from "firebase/auth";
import useAuth from "./hooks/useAuth";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { role, canViewHistory } = useAuth();

  // Define base navLinks array for navigation
  const baseNavLinks = [
    { to: '/', label: 'Home' },
    { to: '/form', label: 'Daily Form' },
    { to: '/demo-sales-list', label: 'Demo Sales List' },
    { to: '/history', label: 'History' },
    { to: '/member-page', label: 'Member' },
    { to: '/route-planner', label: 'Route Planner' },
    { to: '/view-route', label: 'View Route' },
  ];

  // Filter links dynamically based on user role and history permissions
  const navLinks = baseNavLinks.filter(link => {
    // Open pages for all authenticated users
    if (['/', '/member-page', '/route-planner', '/view-route'].includes(link.to)) {
      return true;
    }
    // Demo sales is open to all users
    if (link.to === '/demo-sales-list') {
      return true;
    }
    // Daily Form is restricted to Admin, Manager, and Field Officer
    if (link.to === '/form') {
      return ['admin', 'manager', 'field_officer'].includes(role);
    }
    // History requires Admin role or explicit access granted by Admin
    if (link.to === '/history') {
      return role === 'admin' || canViewHistory;
    }
    return false;
  });


  // Append Admin Panel page for Admin users
  if (role === 'admin') {
    navLinks.push({ to: '/admin-panel', label: 'Admin Panel' });
  }

  // ✅ Define logout function properly
  const handleLogout = async () => {
    const confirmed = window.confirm("Are you sure you want to logout?");
    if (!confirmed) return;

    try {
      const auth = getAuth();
      await signOut(auth);
      navigate("/login"); // redirect after logout
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };


  useEffect(() => {
    const handleResize = () => {
      setMobile(window.innerWidth <= 700);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="navbar navbar-unified" style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', boxShadow: '0 2px 8px #2563eb11' }}>
      <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={logo} alt="Logo" className="navbar-logo" style={{ height: 38, width: 38 }} />
        <span className="navbar-title" style={{ fontWeight: 700, fontSize: '1.2em', color: '#174ea6' }}>Field Officer Portal</span>
      </div>
      {mobile ? (
        <>
          <button
            className="navbar-hamburger"
            aria-label="Menu"
            onClick={() => setMenuOpen((m) => !m)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '2em',
              color: '#174ea6',
              marginLeft: 'auto',
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            ☰
          </button>
          {menuOpen && (
            <div className="navbar-links-mobile" style={{
              position: 'absolute',
              top: 60,
              left: 0,
              width: '100%',
              background: '#fff',
              boxShadow: '0 2px 12px #2563eb22',
              borderRadius: '0 0 16px 16px',
              padding: '18px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              zIndex: 200,
            }}>
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`navbar-link${location.pathname === link.to ? " active" : ""}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '14px 0',
                    textAlign: 'center',
                    fontSize: '1.15em',
                    color: location.pathname === link.to ? '#2563eb' : '#174ea6',
                    fontWeight: location.pathname === link.to ? 700 : 500,
                    background: location.pathname === link.to ? '#e3eefd' : 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    textDecoration: 'none',
                  }}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                style={{
                  background: '#fff',
                  color: '#b91c1c',
                  border: '1.5px solid #e3eefd',
                  borderRadius: '8px',
                  padding: '12px 0',
                  width: '90%',
                  margin: '10px auto 0 auto',
                  fontWeight: 700,
                  fontSize: '1.08em',
                  cursor: 'pointer',
                  boxShadow: '0 1px 6px #2563eb11',
                }}
              >
                Logout
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="navbar-links" style={{ display: 'flex', gap: 18, alignItems: 'center', marginLeft: 'auto' }}>
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`navbar-link${location.pathname === link.to ? " active" : ""}`}
              style={{
                padding: '8px 18px',
                fontSize: '1.08em',
                color: location.pathname === link.to ? '#2563eb' : '#174ea6',
                fontWeight: location.pathname === link.to ? 700 : 500,
                background: location.pathname === link.to ? '#e3eefd' : 'transparent',
                border: 'none',
                borderRadius: 8,
                textDecoration: 'none',
              }}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            style={{
              background: '#fff',
              color: '#b91c1c',
              border: '1.5px solid #e3eefd',
              borderRadius: '8px',
              padding: '8px 18px',
              fontWeight: 700,
              fontSize: '1.08em',
              cursor: 'pointer',
              boxShadow: '0 1px 6px #2563eb11',
            }}
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
