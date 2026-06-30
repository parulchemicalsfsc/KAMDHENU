import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { toggleHistoryAccess, updateUserRole, createNewUser } from "../services/userService";
import { toast } from "react-toastify";
import useAuth from "../hooks/useAuth";

export default function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // States for creating a new user
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [creatingUser, setCreatingUser] = useState(false);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newEmail.trim() || !newPassword) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setCreatingUser(true);
    try {
      await createNewUser(newUsername, newEmail, newPassword, newRole);
      toast.success("User created successfully!");
      // Reset form
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("user");
    } catch (error) {
      console.error("Error creating user:", error);
      let errorMsg = "Failed to create user.";
      if (error?.code === "auth/email-already-in-use") {
        errorMsg = "This email is already in use.";
      } else if (error?.code === "auth/invalid-email") {
        errorMsg = "Invalid email address format.";
      } else if (error?.code === "auth/weak-password") {
        errorMsg = "Password is too weak. Must be at least 6 characters.";
      } else if (error?.message) {
        errorMsg = error.message;
      }
      toast.error(errorMsg);
    } finally {
      setCreatingUser(false);
    }
  };

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
        {/* Create New User Card */}
        <div
          className="section-card"
          style={{
            background: "#fff",
            padding: 32,
            borderRadius: 16,
            boxShadow: "0 4px 20px #2563eb11",
            marginBottom: 32,
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
            👤 Create New User Account
          </h2>
          <p
            style={{
              color: "#64748b",
              fontSize: "1rem",
              margin: "0 0 24px 0",
            }}
          >
            Add a new user with their name, email, password, and system role.
          </p>

          <form
            onSubmit={handleCreateUser}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 20,
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                Username / Name
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
                placeholder="John Doe"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1.5px solid #cbd5e1",
                  fontSize: "0.95rem",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                Email Address
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                placeholder="johndoe@example.com"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1.5px solid #cbd5e1",
                  fontSize: "0.95rem",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Min 6 characters"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1.5px solid #cbd5e1",
                  fontSize: "0.95rem",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                System Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1.5px solid #cbd5e1",
                  background: "#fff",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                <option value="user">User (Regular)</option>
                <option value="field_officer">Field Officer</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <button
                type="submit"
                disabled={creatingUser}
                style={{
                  background: creatingUser ? "#9ca3af" : "#2563eb",
                  color: "#fff",
                  padding: "12px 28px",
                  borderRadius: 8,
                  border: "none",
                  fontWeight: 700,
                  fontSize: "1rem",
                  cursor: creatingUser ? "not-allowed" : "pointer",
                  transition: "background 0.2s",
                }}
              >
                {creatingUser ? "Creating Account..." : "Create User"}
              </button>
            </div>
          </form>
        </div>

        {/* Existing User Access Management Card */}
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
