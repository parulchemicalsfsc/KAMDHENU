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
  const [user, setUser] = useState({ email: 'admin@gmail.com', uid: 'mock-uid' });
  const [role, setRole] = useState("admin");
  const [canViewHistory, setCanViewHistory] = useState(true);
  const [profile, setProfile] = useState({ name: 'Admin User', role: 'admin' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
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
