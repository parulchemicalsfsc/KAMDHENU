import React, { createContext, useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { db } from "../firebase";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user"); // Default fallback role
  const [canViewHistory, setCanViewHistory] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    let unsubscribeFirestore = null;

    const tryRefreshToken = async () => {
      if (!auth.currentUser) return;

      try {
        await auth.currentUser.getIdToken(true);
        console.log("[Auth] Token refreshed after reconnect.");
        toast.success("Back online. Session refreshed.", { autoClose: 3000 });
      } catch (error) {
        console.error("[Auth] Token refresh failed:", error);
        toast.error(
          "Session expired while offline. Please login again to sync pending submissions.",
          { autoClose: 8000 },
        );
        await signOut(auth).catch((signOutError) => {
          console.error("[Auth] Sign-out failed:", signOutError);
        });
        setUser(null);
        setProfile(null);
        setRole("user");
        setCanViewHistory(false);
        setLoading(false);
      }
    };

    const handleOnline = () => {
      tryRefreshToken();
    };

    window.addEventListener("online", handleOnline);

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      // Clean up previous Firestore listener if any
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (currentUser) {
        const rawEmail = currentUser.email || "";
        const normalizedEmail = rawEmail.trim().toLowerCase();
        const emailCandidates = [
          ...new Set([normalizedEmail, rawEmail.trim()]),
        ].filter((value) => value);

        const loadUserProfile = async () => {
          let userDoc = null;

          if (currentUser.uid) {
            const uidQuery = query(
              collection(db, "users"),
              where("uid", "==", currentUser.uid),
            );
            const uidSnap = await getDocs(uidQuery);
            if (!uidSnap.empty) {
              userDoc = uidSnap.docs[0];
            }
          }

          if (!userDoc && emailCandidates.length > 0) {
            const emailQuery = query(
              collection(db, "users"),
              where("email", "in", emailCandidates),
            );
            const emailSnap = await getDocs(emailQuery);
            if (!emailSnap.empty) {
              userDoc = emailSnap.docs[0];
            }
          }

          if (userDoc) {
            const snapshotRef = userDoc.ref;
            unsubscribeFirestore = onSnapshot(
              snapshotRef,
              async (snapshot) => {
                const data = snapshot.data();
                if (data && data.isDeleted) {
                  toast.error("Your account has been deactivated. Please contact support.", {
                    toastId: "account-deactivated-toast",
                  });
                  try {
                    await signOut(auth);
                  } catch (err) {
                    console.error("Error signing out deleted user:", err);
                  }
                  setUser(null);
                  setProfile(null);
                  setRole("user");
                  setCanViewHistory(false);
                  setLoading(false);
                  return;
                }
                const normalizedRole =
                  typeof data.role === "string"
                    ? data.role.trim().toLowerCase()
                    : "user";

                const shouldUpgradeAdmin =
                  normalizedEmail === "admin@gmail.com" &&
                  normalizedRole !== "admin";
                if (shouldUpgradeAdmin) {
                  try {
                    await updateDoc(snapshotRef, {
                      role: "admin",
                      canViewHistory: true,
                    });
                  } catch (updateError) {
                    console.error("Error updating admin role:", updateError);
                  }
                }

                setProfile({ id: snapshot.id, ...data });
                setRole(shouldUpgradeAdmin ? "admin" : normalizedRole);
                setCanViewHistory(
                  shouldUpgradeAdmin ? true : data.canViewHistory || false,
                );
                setLoading(false);
              },
              (error) => {
                console.error("Error fetching Firestore user data:", error);
                setLoading(false);
              },
            );
          } else {
            const isAdminEmail = normalizedEmail === "admin@gmail.com";
            const newUserProfile = {
              uid: currentUser.uid,
              email: normalizedEmail,
              username:
                currentUser.displayName ||
                normalizedEmail.split("@")[0] ||
                "User",
              role: isAdminEmail ? "admin" : "user",
              canViewHistory: isAdminEmail,
              notifications: [],
              createdAt: new Date().toISOString(),
            };

            try {
              const newDocRef = await addDoc(
                collection(db, "users"),
                newUserProfile,
              );
              setProfile({ id: newDocRef.id, ...newUserProfile });
              setRole(isAdminEmail ? "admin" : "user");
              setCanViewHistory(isAdminEmail);
            } catch (createError) {
              console.error(
                "Error creating Firestore user profile:",
                createError,
              );
              setProfile(null);
              setRole("user");
              setCanViewHistory(false);
            }
            setLoading(false);
          }
        };

        loadUserProfile();
      } else {
        // User logged out
        setProfile(null);
        setRole("user");
        setCanViewHistory(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      window.removeEventListener("online", handleOnline);
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  const value = {
    user,
    role,
    canViewHistory,
    profile,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
