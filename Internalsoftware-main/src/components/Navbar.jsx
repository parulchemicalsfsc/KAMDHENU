import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "../style/form.css";
import { getAuth, signOut } from "firebase/auth";
import useAuth from "../hooks/useAuth";
import { markNotificationAsRead, markAllNotificationsAsRead } from "../services/notificationService";


export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, role, canViewHistory, profile } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  // Derive unread notifications from profile data
  const notifications = React.useMemo(() => {
    const list = profile?.notifications || [];
    const unread = list.filter(n => !n.read);
    return [...unread].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [profile?.notifications]);

  // Define base navLinks array for navigation
  const baseNavLinks = [
    { to: '/', label: 'Home' },
    { to: '/view-route', label: 'View Route' },
  ];

  // Filter links dynamically based on user role and history permissions
  const navLinks = baseNavLinks.filter(link => {
    // Open pages for all authenticated users
    if (['/', '/view-route'].includes(link.to)) {
      return true;
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
    setShowDropdown(false);
  }, [location.pathname]);

  const renderNotificationBell = () => {
    if (!user) return null;

    return (
      <div className="notification-bell-container" style={{ position: "relative" }}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          style={{
            background: "none",
            border: "none",
            fontSize: "1.4em",
            cursor: "pointer",
            position: "relative",
            display: "flex",
            alignItems: "center",
            padding: "8px",
            borderRadius: "50%",
            color: "#174ea6",
            transition: "background 0.2s",
          }}
          title="Notifications"
        >
          🔔
          {notifications.length > 0 && (
            <span style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              background: "#ef4444",
              color: "#fff",
              borderRadius: "50%",
              padding: "2px 6px",
              fontSize: "0.7rem",
              fontWeight: 700,
              minWidth: "16px",
              height: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px #fff",
            }}>
              {notifications.length}
            </span>
          )}
        </button>

        {showDropdown && (
          <div style={{
            position: "absolute",
            right: 0,
            top: "45px",
            width: "280px",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
            border: "1px solid #e2e8f0",
            zIndex: 150,
            padding: "12px",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #f1f5f9",
              paddingBottom: "8px",
              marginBottom: "8px",
            }}>
              <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.95rem" }}>Notifications</span>
              {notifications.length > 0 && (
                <button
                  onClick={() => markAllNotificationsAsRead(profile?.id, profile?.notifications)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "2px 6px",
                  }}
                >
                  Clear All
                </button>
              )}
            </div>

            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px 0", color: "#64748b", fontSize: "0.85rem" }}>
                  No new notifications
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    style={{
                      padding: "8px",
                      borderRadius: "6px",
                      background: "#f8fafc",
                      marginBottom: "6px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "8px",
                      border: "1px solid #f1f5f9",
                    }}
                  >
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "#1e293b", marginBottom: "2px" }}>
                        {notif.title}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#475569", lineHeight: "1.2" }}>
                        {notif.message}
                      </div>
                    </div>
                    <button
                      onClick={() => markNotificationAsRead(profile?.id, profile?.notifications, notif.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#94a3b8",
                        cursor: "pointer",
                        fontSize: "1rem",
                        lineHeight: 1,
                        padding: "0px 4px",
                        fontWeight: 700,
                      }}
                      title="Mark as read"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="navbar navbar-unified" style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', boxShadow: '0 2px 8px #2563eb11' }}>
      <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={logo} alt="Logo" className="navbar-logo" style={{ height: 38, width: 38 }} />
        <span className="navbar-title" style={{ fontWeight: 700, fontSize: '1.2em', color: '#174ea6' }}>Field Officer Portal</span>
      </div>
      {mobile ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            {renderNotificationBell()}
            <button
              className="navbar-hamburger"
              aria-label="Menu"
              onClick={() => setMenuOpen((m) => !m)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '2em',
                color: '#174ea6',
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              ☰
            </button>
          </div>
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
        <div className="navbar-links" style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`navbar-link${location.pathname === link.to ? " active" : ""}`}
              style={{
                padding: '6px 10px',
                fontSize: '0.98em',
                color: location.pathname === link.to ? '#2563eb' : '#174ea6',
                fontWeight: location.pathname === link.to ? 700 : 500,
                background: location.pathname === link.to ? '#e3eefd' : 'transparent',
                border: 'none',
                borderRadius: 8,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {renderNotificationBell()}
          <button
            onClick={handleLogout}
            style={{
              background: '#fff',
              color: '#b91c1c',
              border: '1.5px solid #e3eefd',
              borderRadius: '8px',
              padding: '6px 10px',
              fontWeight: 700,
              fontSize: '0.98em',
              cursor: 'pointer',
              boxShadow: '0 1px 6px #2563eb11',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
