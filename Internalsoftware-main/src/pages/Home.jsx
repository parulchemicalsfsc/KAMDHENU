import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../style/form.css";
import useAuth from "../hooks/useAuth";
import { addFieldOfficer } from "../services/userService";
import { toast } from "react-toastify";
import { db } from "../firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { Pie, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

export default function Home() {
  const { user, profile, role, canViewHistory } = useAuth();
  const [officerEmail, setOfficerEmail] = useState("");
  const [addingOfficer, setAddingOfficer] = useState(false);
  const [summaryData, setSummaryData] = useState({ totalRoutes: 0, totalPayment: 0, paymentTarget: 0, totalOrders: 0, totalCustomers: 0 });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const routeSnap = await getDocs(query(collection(db, "routePlans"), orderBy("createdAt", "desc"), limit(100)));
        const routeData = routeSnap.docs.map(doc => doc.data());
        let totalRoutes = routeData.length;
        let totalPayment = 0;
        let paymentTarget = 0;
        let totalOrders = 0;
        
        routeData.forEach(plan => {
          if (plan.routes) {
            plan.routes.forEach(r => {
              paymentTarget += Number(r.paymentTarget || 0);
              totalPayment += Number(r.paymentCollected || 0);
              if (r.actualStock) {
                r.actualStock.forEach(s => totalOrders += Number(s.qty || 0));
              }
            });
          }
        });

        const custSnap = await getDocs(query(collection(db, "customers"), limit(500)));
        let totalCustomers = custSnap.docs.length;

        setSummaryData({ totalRoutes, totalPayment, paymentTarget, totalOrders, totalCustomers });
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      }
    };
    
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const handleAddOfficer = async (e) => {
    e.preventDefault();
    if (!officerEmail.trim()) return;

    setAddingOfficer(true);
    try {
      const success = await addFieldOfficer(user.uid, officerEmail, user.email);
      if (success) {
        toast.success(`Successfully added ${officerEmail} as a Field Officer!`);
        setOfficerEmail("");
      } else {
        toast.error(`User with email ${officerEmail} not found.`);
      }
    } catch (err) {
      console.error("Error adding officer:", err);
      toast.error("Failed to add Field Officer: " + err.message);
    } finally {
      setAddingOfficer(false);
    }
  };

  const quickActions = [];

  if (['admin', 'manager', 'field_officer'].includes(role)) {
    quickActions.push({
      to: "/form",
      icon: "📝",
      title: "Daily Form",
      description: "Record today's milk and chemical collection data across your assigned route."
    });
  }

  quickActions.push({
    to: "/demo-sales-list",
    icon: "🧾",
    title: "Demo Sales",
    description: "Log product demonstrations, sampling results, and potential sales leads."
  });

  quickActions.push({
    to: "/member-page",
    icon: "👥",
    title: "Members",
    description: "Manage producer profiles and view detailed client performance metrics."
  });

  if (role === 'admin' || canViewHistory) {
    quickActions.push({
      to: "/history",
      icon: "📜",
      title: "History",
      description: "Review past entry records, submission logs, and performance analytics."
    });
  }

  if (role !== 'field_officer') {
    quickActions.push({
      to: "/MoM-generator",
      icon: "📋",
      title: "Generate MOM",
      description: "Create and manage meeting minutes and reports."
    });
  }

  quickActions.push({
    to: "/route-planner",
    icon: "🗺️",
    title: "Route",
    description: "Plan and view your daily field routes."
  });

  quickActions.push({
    to: "/stock-dashboard",
    icon: "📦",
    title: "Stock Dashboard",
    description: "Monitor inventory levels and stock movements."
  });

  const pieData = {
    labels: ["Collected (₹)", "Pending (₹)"],
    datasets: [{
      data: [summaryData.totalPayment, Math.max(0, summaryData.paymentTarget - summaryData.totalPayment)],
      backgroundColor: ["#10b981", "#f59e0b"],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  const barData = {
    labels: ["Orders", "Routes", "Customers"],
    datasets: [{
      label: "System Metrics",
      data: [summaryData.totalOrders, summaryData.totalRoutes, summaryData.totalCustomers],
      backgroundColor: ["#3b82f6", "#8b5cf6", "#ec4899"],
      borderRadius: 6,
    }]
  };

  return (
    <div className="app-container">
      <Navbar />
      <div className="home-dashboard">
        
        {/* Welcome Banner */}
        <div className="welcome-banner">
          <div className="banner-content">
            {user && (
              <h2 className="welcome-title">
                Hello, {profile?.username || user.displayName || user.email}
              </h2>
            )}
            <p className="welcome-subtitle">Welcome! Choose an action below to get started.</p>
          </div>
        </div>

        {/* Business Overview Section */}
        <div className="dashboard-section" style={{ marginTop: '24px' }}>
          <h3 className="section-title">BUSINESS OVERVIEW</h3>
          
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderLeft: '4px solid #3b82f6' }}>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>TOTAL CUSTOMERS</p>
              <h4 style={{ margin: '8px 0 0', fontSize: '2rem', color: '#1e293b', fontWeight: 900 }}>{summaryData.totalCustomers}</h4>
            </div>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderLeft: '4px solid #8b5cf6' }}>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>COMPLETED ROUTES</p>
              <h4 style={{ margin: '8px 0 0', fontSize: '2rem', color: '#1e293b', fontWeight: 900 }}>{summaryData.totalRoutes}</h4>
            </div>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderLeft: '4px solid #10b981' }}>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>TOTAL COLLECTED</p>
              <h4 style={{ margin: '8px 0 0', fontSize: '2rem', color: '#1e293b', fontWeight: 900 }}>₹{summaryData.totalPayment}</h4>
            </div>
          </div>

          {/* Charts Area */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Pie Chart Card */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
              <h4 style={{ margin: '0 0 20px', color: '#334155', fontWeight: 800, textAlign: 'center' }}>Payments: Target vs Collected</h4>
              <div style={{ position: 'relative', height: '240px', display: 'flex', justifyContent: 'center' }}>
                <Pie data={pieData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
              </div>
            </div>

            {/* Bar Chart Card */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
              <h4 style={{ margin: '0 0 20px', color: '#334155', fontWeight: 800, textAlign: 'center' }}>Overall Engagement Metrics</h4>
              <div style={{ position: 'relative', height: '240px' }}>
                <Bar data={barData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="dashboard-section" style={{ marginTop: '32px' }}>
          <h3 className="section-title">QUICK ACTIONS</h3>
          <div className="quick-actions-grid">
            {quickActions.map((action, idx) => (
              <Link to={action.to} className="action-card" key={idx}>
                <div className="action-icon-wrapper">
                  <span className="action-icon">{action.icon}</span>
                </div>
                <div className="action-details">
                  <h4 className="action-title">{action.title}</h4>
                  <p className="action-description">{action.description}</p>
                </div>
                <div className="action-arrow">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Manager Section: Add Field Officer */}
        {role === "manager" && (
          <div className="manager-card">
            <div className="manager-card-header">
              <span className="manager-icon">👤</span>
              <h3 className="manager-title">Add Field Officer</h3>
            </div>
            <p className="manager-desc">
              Enter the email of a registered user to assign them as a Field Officer.
            </p>
            <form onSubmit={handleAddOfficer} className="manager-form">
              <input
                type="email"
                placeholder="Field Officer's email"
                value={officerEmail}
                onChange={(e) => setOfficerEmail(e.target.value)}
                required
                className="manager-input"
              />
              <button
                type="submit"
                disabled={addingOfficer}
                className="manager-btn"
              >
                {addingOfficer ? "Adding..." : "Add Officer"}
              </button>
            </form>
          </div>
        )}


      </div>
    </div>
  );
}

