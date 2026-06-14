import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";
import Navbar from "../components/Navbar";
import "../style/form.css";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function RouteViewer() {
  const [summary, setSummary] = useState({ totalRoutes: 0, totalPayment: 0, paymentTarget: 0, totalOrders: 0 });
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    const fetchRoutes = async () => {
      const snapshot = await getDocs(collection(db, "routePlans"));
      const data = snapshot.docs.map(doc => doc.data());

      const dateList = [...new Set(data.map(d => d.date))];
      setDates(dateList);

      let totalRoutes = data.length;
      let totalPayment = 0;
      let paymentTarget = 0;
      let totalOrders = 0;

      data.forEach(plan => {
        if (plan.routes) {
          plan.routes.forEach(route => {
            paymentTarget += Number(route.paymentTarget || 0);
            totalPayment += Number(route.paymentCollected || 0);
            if (route.actualStock) {
              route.actualStock.forEach(stock => {
                totalOrders += Number(stock.qty || 0);
              });
            }
          });
        }
      });

      setSummary({ totalRoutes, totalPayment, paymentTarget, totalOrders });
    };

    fetchRoutes();
  }, []);

  const paymentChartData = {
    labels: ["Collected", "Pending"],
    datasets: [
      {
        data: [summary.totalPayment, summary.paymentTarget - summary.totalPayment],
        backgroundColor: ["#4CAF50", "#FF9800"],
      }
    ]
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    console.log("Selected date:", e.target.value);
    // Later: fetch filtered villages for that date
  };

  return (
    <>
      <Navbar />
      <div style={{ padding: "clamp(12px, 3vw, 24px)" }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", background: "#f7fafd",
          borderRadius: 18, border: "1px solid #d1e3f8",
          boxShadow: "0 8px 32px rgba(13, 110, 253, 0.08)", overflow: "hidden"
        }}>
          <div style={{
            background: "linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)",
            padding: "20px 24px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <h2 style={{ margin: 0, fontWeight: 700, fontSize: "1.5rem" }}>🗺️ Route Summary</h2>
          </div>

          <div style={{ padding: "24px" }}>
            <div className="section-card" style={{ marginBottom: 24, textAlign: 'left', borderRadius: 14, boxShadow: '0 2px 12px #2563eb11', background: '#fff', padding: '24px 18px' }}>
              
              <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
                <label style={{ fontWeight: 700, color: "#174ea6", fontSize: "1.1em" }}>SELECT DATE:</label>
                <select value={selectedDate} onChange={handleDateChange} style={{ flex: 1, maxWidth: 300, borderRadius: 8, padding: "10px 12px", border: "2px solid #b6c7e6", fontFamily: "inherit", fontSize: "1em", background: "#f8fafc" }}>
                  <option value="">--Choose--</option>
                  {dates.map((date, index) => (
                    <option key={index} value={date}>{date}</option>
                  ))}
                </select>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                marginBottom: 32
              }}>
                <div style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", padding: "20px", borderRadius: 12, border: "2px solid #bfdbfe", textAlign: "center" }}>
                  <div style={{ color: "#1e40af", fontSize: "0.9em", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Routes</div>
                  <div style={{ fontSize: "2rem", fontWeight: 900, color: "#1d4ed8" }}>{summary.totalRoutes}</div>
                </div>
                <div style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", padding: "20px", borderRadius: 12, border: "2px solid #bbf7d0", textAlign: "center" }}>
                  <div style={{ color: "#166534", fontSize: "0.9em", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Collected Value</div>
                  <div style={{ fontSize: "2rem", fontWeight: 900, color: "#15803d" }}>₹{summary.totalPayment}</div>
                </div>
                <div style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", padding: "20px", borderRadius: 12, border: "2px solid #fde68a", textAlign: "center" }}>
                  <div style={{ color: "#b45309", fontSize: "0.9em", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Target</div>
                  <div style={{ fontSize: "2rem", fontWeight: 900, color: "#d97706" }}>₹{summary.paymentTarget}</div>
                </div>
                <div style={{ background: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)", padding: "20px", borderRadius: 12, border: "2px solid #e9d5ff", textAlign: "center" }}>
                  <div style={{ color: "#6b21a8", fontSize: "0.9em", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Orders</div>
                  <div style={{ fontSize: "2rem", fontWeight: 900, color: "#7e22ce" }}>{summary.totalOrders}</div>
                </div>
              </div>

              <div style={{ maxWidth: 400, margin: "0 auto" }}>
                <h3 style={{ textAlign: "center", color: "#174ea6", marginBottom: 16 }}>Payment Overview</h3>
                <Pie data={paymentChartData} />
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
