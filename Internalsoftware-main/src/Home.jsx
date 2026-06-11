import React, { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import "./form.css";
import useAuth from "./hooks/useAuth";
import { addFieldOfficer } from "./services/userService";
import { toast } from "react-toastify";

export default function Home() {
  const { user, profile, role, canViewHistory } = useAuth();
  const [officerEmail, setOfficerEmail] = useState("");
  const [addingOfficer, setAddingOfficer] = useState(false);

  const handleAddOfficer = async (e) => {
    e.preventDefault();
    if (!officerEmail.trim()) return;

    setAddingOfficer(true);
    try {
      const success = await addFieldOfficer(user.uid, officerEmail);
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


  return (
    <>
      <Navbar />
      <div
        className="form-container"
        style={{ maxWidth: 480, marginTop: 40, textAlign: "center" }}
      >
        {user && (
          <h2
            style={{
              color: "#2c3e50",
              fontWeight: 700,
              marginBottom: 20,
              fontSize: "1.6rem",
            }}
          >
            Hello {profile?.username || user.displayName || user.email}, 🚀<br />
            Let’s get going!
          </h2>
        )}

        <h1
          style={{
            color: "#1976d2",
            fontWeight: 900,
            fontSize: "2.1rem",
            marginBottom: 8,
            letterSpacing: "0.04em",
          }}
        >
          KAMDHENU
        </h1>
        <p
          style={{
            color: "#7b8ca6",
            fontWeight: 500,
            marginBottom: 32,
            fontSize: "1.08em",
          }}
        >
          Welcome! Choose an action below to get started.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            marginBottom: 32,
          }}
        >
          {['admin', 'manager', 'field_officer'].includes(role) && (
            <Link
              to="/form"
              className="btn-primary"
              style={{ fontSize: "1.1em", padding: "16px 0" }}
            >
              📝 Fill Daily Form
            </Link>
          )}

          <Link
            to="/demo-sales-list"
            className="btn-outline"
            style={{ fontSize: "1.1em", padding: "16px 0" }}
          >
            🧾 Demo Sales List
          </Link>

          {role !== 'field_officer' && (
            <Link
              to="/demo-history"
              className="btn-outline"
              style={{ fontSize: "1.1em", padding: "16px 0" }}
            >
              📊 Demo Sales History
            </Link>
          )}

          {role !== 'field_officer' && (
            <Link
              to="/MoM-generator"
              className="btn-outline"
              style={{ fontSize: "1.1em", padding: "16px 0" }}
            >
              📝 Generate MoM
            </Link>
          )}

          <Link
            to="/member-page"
            className="btn-outline"
            style={{ fontSize: "1.1em", padding: "16px 0" }}
          >
            Member Demo Entry
          </Link>

          {(role === 'admin' || canViewHistory) && (
            <Link
              to="/history"
              className="btn-outline"
              style={{ fontSize: "1.1em", padding: "16px 0" }}
            >
              📜 View Submission History
            </Link>
          )}
        </div>


        {/* Manager Section: Add Field Officer */}
        {role === "manager" && (
          <div
            className="section-card"
            style={{
              background: "#fff",
              border: "1.5px solid #e2e8f0",
              margin: "0 auto 24px auto",
              padding: 20,
              borderRadius: 12,
              textAlign: "left"
            }}
          >
            <h3 style={{ color: "#1e293b", margin: "0 0 4px 0", fontSize: "1.1rem", fontWeight: 700 }}>
              👤 Add Field Officer
            </h3>
            <p style={{ color: "#64748b", margin: "0 0 16px 0", fontSize: "0.85rem" }}>
              Enter the email of a registered user to assign them as a Field Officer.
            </p>
            <form onSubmit={handleAddOfficer} style={{ display: "flex", gap: 10 }}>
              <input
                type="email"
                placeholder="Field Officer's email"
                value={officerEmail}
                onChange={(e) => setOfficerEmail(e.target.value)}
                required
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1.5px solid #cbd5e1",
                  fontSize: "0.95rem"
                }}
              />
              <button
                type="submit"
                disabled={addingOfficer}
                className="btn-primary"
                style={{
                  padding: "0 18px",
                  borderRadius: 8,
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap"
                }}
              >
                {addingOfficer ? "Adding..." : "Add"}
              </button>
            </form>
          </div>
        )}


        <div
          className="section-card"
          style={{
            background: "#f7fafd",
            margin: "0 auto",
            marginBottom: 0,
            padding: 18,
          }}
        >
          <h3
            style={{
              color: "#2563eb",
              fontWeight: 700,
              margin: 0,
              marginBottom: 8,
              fontSize: "1.08em",
            }}
          >
            Dashboard (Coming Soon)
          </h3>
          <ul
            style={{
              color: "#7b8ca6",
              fontWeight: 500,
              fontSize: "1em",
              margin: 0,
              padding: 0,
              listStyle: "none",
            }}
          >
            <li>• Quick stats and analytics will appear here.</li>
            <li>• Recent submissions, expense totals, and more.</li>
          </ul>
        </div>

        <footer className="footer-credit" style={{ marginTop: 32 }}>
          <small>Powered by Parul Chemicals • FS CALCIVAL</small>
        </footer>
      </div>
    </>
  );
}
