import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import {
  toggleHistoryAccess,
  updateUserRole,
  createUser,
} from "../services/userService";
import { toast } from "react-toastify";
import useAuth from "../hooks/useAuth";

export default function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    username: "",
    role: "user",
    canViewHistory: false,
  });

  useEffect(() => {
    // Set up a real-time listener for all user profiles
    const unsub = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const usersList = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((u) => {
            const email = (u.email || "").trim().toLowerCase();
            return u.role !== "admin" && email !== "admin@gmail.com";
          });
        // Sort users by email for structured display
        usersList.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
        setUsers(usersList);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading users:", error);
        toast.error("Failed to load users list.");
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  const handleRoleChange = async (userId, newRole, targetEmail) => {
    try {
      await updateUserRole(userId, newRole, targetEmail, user?.email);
      toast.success("User role updated successfully!");
    } catch (error) {
      console.error("Error changing role:", error);
      toast.error("Failed to update user role.");
    }
  };

  const handleHistoryToggle = async (userId, currentStatus) => {
    try {
      await toggleHistoryAccess(userId, !currentStatus);
      toast.success("History access permission updated!");
    } catch (error) {
      console.error("Error toggling history access:", error);
      toast.error("Failed to update history access.");
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await createUser(newUser);
      if (res.created) {
        toast.success("User created successfully.");
        setNewUser({
          email: "",
          username: "",
          role: "user",
          canViewHistory: false,
        });
        setShowAddForm(false);
      } else if (res.reason === "exists") {
        toast.info("A user with this email already exists.");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error("Failed to create user.");
    }
  };

  return (
    <>
      <Navbar />
      <div
        style={{
          maxWidth: 1000,
          margin: "40px auto",
          padding: "0 20px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          className="section-card"
          style={{
            background: "#fff",
            padding: 32,
            borderRadius: 16,
            boxShadow: "0 4px 20px #2563eb11",
          }}
        >
          <h2
            style={{
              color: "#174ea6",
              fontWeight: 800,
              fontSize: "1.8rem",
              margin: "0 0 8px 0",
            }}
          >
            👥 User Access Management
          </h2>
          <p
            style={{
              color: "#64748b",
              fontSize: "1rem",
              margin: "0 0 32px 0",
            }}
          >
            Manage user roles and toggle eligibility for viewing the History
            page.
          </p>

          <div style={{ marginBottom: 18 }}>
            <button
              onClick={() => setShowAddForm((s) => !s)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: "#0ea5e9",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {showAddForm ? "Cancel" : "+ Add User"}
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleCreateUser} style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  required
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    minWidth: 220,
                  }}
                />
                <input
                  type="text"
                  placeholder="Username"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value })
                  }
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    minWidth: 180,
                  }}
                />
                <select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role: e.target.value })
                  }
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                  }}
                >
                  <option value="user">User</option>
                  <option value="field_officer">Field Officer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <label
                  style={{ display: "flex", gap: 6, alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={!!newUser.canViewHistory}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        canViewHistory: e.target.checked,
                      })
                    }
                  />
                  Can view history
                </label>
                <button
                  type="submit"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#16a34a",
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Create
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: "#64748b",
              }}
            >
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: "#64748b",
              }}
            >
              No registered users found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "2px solid #cbd5e1",
                      color: "#1e293b",
                      fontWeight: 700,
                    }}
                  >
                    <th style={{ padding: "12px 16px" }}>Username</th>
                    <th style={{ padding: "12px 16px" }}>Email</th>
                    <th style={{ padding: "12px 16px" }}>Role</th>
                    <th
                      style={{ padding: "12px 16px", textAlignment: "center" }}
                    >
                      Eligible for History Page
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: "1.5px solid #f1f5f9",
                        color: "#334155",
                      }}
                    >
                      <td style={{ padding: "16px 16px", fontWeight: 600 }}>
                        {u.username || u.displayName || "—"}
                      </td>
                      <td style={{ padding: "16px 16px" }}>{u.email}</td>
                      <td style={{ padding: "16px 16px" }}>
                        <select
                          value={u.role || "user"}
                          onChange={(e) =>
                            handleRoleChange(u.id, e.target.value, u.email)
                          }
                          style={{
                            padding: "8px 12px",
                            borderRadius: 6,
                            border: "1.5px solid #cbd5e1",
                            background: "#fff",
                            color: "#1e293b",
                            fontSize: "0.9rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <option value="user">User (Regular)</option>
                          <option value="field_officer">Field Officer</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td style={{ padding: "16px 16px" }}>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                            fontWeight: 500,
                            color: u.canViewHistory ? "#16a34a" : "#64748b",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!u.canViewHistory}
                            onChange={() =>
                              handleHistoryToggle(u.id, !!u.canViewHistory)
                            }
                            style={{
                              width: 18,
                              height: 18,
                              cursor: "pointer",
                            }}
                          />
                          {u.canViewHistory ? "Authorized" : "Not Allowed"}
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
