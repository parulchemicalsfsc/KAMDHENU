import React, { createContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('user'); // Default fallback role
  const [canViewHistory, setCanViewHistory] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    let unsubscribeFirestore = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      // Clean up previous Firestore listener if any
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (currentUser) {
        // Query user document by email from 'users' collection
        const q = query(
          collection(db, 'users'),
          where('email', '==', currentUser.email)
        );

        // Listen in real-time to user profile changes (role, permissions)
        unsubscribeFirestore = onSnapshot(
          q,
          (querySnapshot) => {
            if (!querySnapshot.empty) {
              // Get the first matching user document
              const userDoc = querySnapshot.docs[0];
              const data = userDoc.data();
              
              setProfile({ id: userDoc.id, ...data });
              setRole(data.role || 'user');
              setCanViewHistory(data.canViewHistory || false);
            } else {
              // User doc doesn't exist in Firestore yet
              setProfile(null);
              setRole('user');
              setCanViewHistory(false);
            }
            setLoading(false);
          },
          (error) => {
            console.error('Error fetching Firestore user data:', error);
            setLoading(false);
          }
        );
      } else {
        // User logged out
        setProfile(null);
        setRole('user');
        setCanViewHistory(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  const value = {
    user,
    role,
    canViewHistory,
    profile,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
