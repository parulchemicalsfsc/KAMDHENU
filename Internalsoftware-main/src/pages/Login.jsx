import React, { useState, useEffect } from "react";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "../style/form.css";
import logo from "../assets/logo.png";
const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const navigate = useNavigate();

  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (!online) {
        setError("");
      }
    };

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!isOnline) {
      setError(
        "Login requires an internet connection. Please go online and try again.",
      );
      return;
    }
    setLoading(true);
    setError("");
    const auth = getAuth();
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      const message = String(err?.message || "").toLowerCase();
      const offlineError =
        err?.code === "auth/network-request-failed" ||
        !navigator.onLine ||
        message.includes("network") ||
        message.includes("internet disconnected") ||
        message.includes("offline");
      setError(
        offlineError
          ? "No internet connection. Please go online to login."
          : "Invalid email or password",
      );
      console.error("Login error:", err);
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7fafd",
      }}
    >
      <form
        onSubmit={handleLogin}
        className="form-container"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 34,
          margin: "32px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <img src={logo} alt="Logo" style={{ width: 88, height: 88 }} />
        </div>

        <h2
          style={{
            textAlign: "center",
            color: "#174ea6",
            fontWeight: 900,
            marginBottom: 14,
          }}
        >
          Login
        </h2>
        {!isOnline && (
          <div
            style={{
              textAlign: "center",
              color: "#475569",
              marginBottom: 18,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            You must login while online. Offline login is not supported.
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 600,
              color: "#1f2937",
            }}
          >
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              borderRadius: 12,
              padding: "12px 14px",
              border: "1px solid #bfdbfe",
              background: "#fff",
              fontFamily: "inherit",
            }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 600,
              color: "#1f2937",
            }}
          >
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              borderRadius: 12,
              padding: "12px 14px",
              border: "1px solid #bfdbfe",
              background: "#fff",
              fontFamily: "inherit",
            }}
          />
        </div>

        {!isOnline && (
          <div
            style={{
              color: "#b45309",
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            You are offline. Login requires internet access.
          </div>
        )}
        {error && (
          <div
            style={{ color: "#ef4444", marginBottom: 12, textAlign: "center" }}
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading || !isOnline}
          style={{
            width: "100%",
            padding: "13px 0",
            borderRadius: 12,
            background: !isOnline ? "#9ca3af" : "#2563eb",
            color: "#fff",
            fontWeight: 700,
            fontSize: "1.05em",
            border: "none",
            cursor: !isOnline ? "not-allowed" : "pointer",
            marginBottom: 8,
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
};

export default Login;
