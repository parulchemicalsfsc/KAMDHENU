import React, { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import jsPDF from "jspdf";
import { db } from "../firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import Navbar from "../components/Navbar";
import "../style/form.css";


const participantsList = ["JASH ILASARIYA", "SONAL MADAM", "BHAVIN PRAJAPATI", "MAULIC SHAH", "JIGAR SHAH", "SHUBHAM", "MISTRY SIR", "JYOTIKA", "BHAVISHA", "PARUL BEN", "MALA BEN", "PRIYANKA BEN ", "OMKAR SIR", "SANKET SIR", "ALPESH SIR"];

const MoMForm = () => {
  const [date, setDate] = useState("");
  const [location, setLocation] = useState({ lat: "", lng: "" });
  const [participants, setParticipants] = useState([]);
  const [manualParticipant, setManualParticipant] = useState("");
  const [points, setPoints] = useState([]);
  const [currentPoint, setCurrentPoint] = useState("");
  const [summary, setSummary] = useState(null);

const handleParticipantChange = (e) => {
  const selectedOptions = Array.from(e.target.selectedOptions);
  setParticipants(selectedOptions.map(option => option.value));
};

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
    setDate(new Date().toISOString().split("T")[0]);
  }, []);

  const handleAddPoint = () => {
    if (currentPoint.trim()) {
      setPoints([...points, currentPoint.trim()]);
      setCurrentPoint("");
    }
  };

  const generateSummary = () => {
    const discussion = points.map((pt, i) => `${i + 1}. ${pt}`).join("\n");
    const actions = points
      .filter((pt) => pt.toLowerCase().includes("action") || pt.toLowerCase().includes("to do"))
      .map((pt) => `- ${pt}`)
      .join("\n");

    setSummary({ discussion, actions });
  };

  const saveToFirestore = async () => {
    const payload = {
      date,
      location,
      participants,
      manualParticipant,
      points,
      summary,
      timestamp: Timestamp.now()
    };
    await addDoc(collection(db, "demo_moms"), payload);
    toast.success('Minutes of Meeting saved! ✓');
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Minutes of Meeting", 20, 20);
    doc.setFontSize(10);
    doc.text(`Date: ${date}`, 20, 30);
    doc.text(`Location: ${location.lat}, ${location.lng}`, 20, 36);
    doc.text(`Participants: ${[...participants, manualParticipant].filter(Boolean).join(", ")}`, 20, 42);
    doc.text("Discussion Summary:", 20, 52);
    doc.text(summary?.discussion || "", 20, 58);
    doc.text("Action Items:", 20, 90);
    doc.text(summary?.actions || "None", 20, 96);
    doc.save("MoM.pdf");
  };

  return (
    <> 
    <Navbar />

      <div style={{ padding: "clamp(12px, 3vw, 24px)" }}>
        <div style={{
          maxWidth: 900, margin: "0 auto", background: "#f7fafd",
          borderRadius: 18, border: "1px solid #d1e3f8",
          boxShadow: "0 8px 32px rgba(13, 110, 253, 0.08)", overflow: "hidden"
        }}>
          <div style={{
            background: "linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)",
            padding: "20px 24px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <h2 style={{ margin: 0, fontWeight: 700, fontSize: "1.5rem" }}>Minutes of Meeting</h2>
          </div>

          <div style={{ padding: "24px" }}>
            <div className="section-card" style={{ marginBottom: 24, textAlign: 'left', borderRadius: 14, boxShadow: '0 2px 12px #2563eb11', background: '#fff', padding: '24px 18px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 18 }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={{ fontWeight: 600, color: '#174ea6', marginBottom: 4, display: 'block' }}>Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', borderRadius: 8, padding: 8, border: '1.5px solid #b6c7e6', fontFamily: 'inherit' }} />
                </div>
                <div style={{ flex: 2, minWidth: 180 }}>
                  <label style={{ fontWeight: 600, color: '#174ea6', marginBottom: 4, display: 'block' }}>Location</label>
                  <div style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", color: "#475569" }}>
                    {location.lat ? `📍 ${location.lat}, ${location.lng}` : "Fetching location..."}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontWeight: 600, color: '#174ea6', marginBottom: 4, display: 'block' }}>Participants</label>
                <select multiple value={participants} onChange={handleParticipantChange} style={{ width: '100%', borderRadius: 8, padding: 8, border: '1.5px solid #b6c7e6', fontFamily: 'inherit', minHeight: 120 }}>
                  {participantsList.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={manualParticipant}
                  placeholder="Add manual participant (comma separated)"
                  onChange={(e) => setManualParticipant(e.target.value)}
                  style={{ width: '100%', borderRadius: 8, padding: 8, border: '1.5px solid #b6c7e6', fontFamily: 'inherit', marginTop: 12 }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontWeight: 600, color: '#174ea6', marginBottom: 4, display: 'block' }}>Add Discussion Point</label>
                <div style={{ display: "flex", gap: 12 }}>
                  <textarea
                    value={currentPoint}
                    onChange={(e) => setCurrentPoint(e.target.value)}
                    placeholder="Enter discussion point..."
                    style={{ flex: 1, borderRadius: 8, padding: 12, border: '1.5px solid #b6c7e6', fontFamily: 'inherit', minHeight: 60 }}
                  />
                  <button onClick={handleAddPoint} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 8, padding: "0 24px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>
                    + Add
                  </button>
                </div>
              </div>

              {points.length > 0 && (
                <div style={{ marginBottom: 24, padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#0f172a" }}>All Discussion Points</h4>
                  <ul style={{ margin: 0, paddingLeft: 20, color: "#334155" }}>
                    {points.map((pt, i) => (<li key={i} style={{ marginBottom: 8 }}>{pt}</li>))}
                  </ul>
                </div>
              )}

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 32 }}>
                <button onClick={generateSummary} style={{ flex: 1, minWidth: 150, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 600, cursor: "pointer" }}>
                  Generate Summary
                </button>
                <button onClick={saveToFirestore} style={{ flex: 1, minWidth: 150, background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 600, cursor: "pointer" }}>
                  Save to Database
                </button>
                <button onClick={generatePDF} style={{ flex: 1, minWidth: 150, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 600, cursor: "pointer" }}>
                  Export as PDF
                </button>
              </div>

              {summary && (
                <div style={{ marginTop: 24, padding: 20, background: "#f0fdf4", border: "2px solid #22c55e", borderRadius: 12 }}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#166534" }}>Summary Preview:</h4>
                  <p style={{ whiteSpace: "pre-line", color: "#15803d", fontSize: "0.95em", margin: 0 }}>{summary.discussion}</p>
                  
                  <h4 style={{ margin: "20px 0 12px 0", color: "#166534" }}>Action Items:</h4>
                  <p style={{ whiteSpace: "pre-line", color: "#b91c1c", fontSize: "0.95em", margin: 0, fontWeight: 600 }}>{summary.actions || "No specific action items found."}</p>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MoMForm;
