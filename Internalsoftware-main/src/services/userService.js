import {
  db,
  auth as firebaseAuth /* app exported separately */,
} from "../firebase";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
  addDoc,
} from "firebase/firestore";
import app from "../firebase";
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as secondarySignOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

/**
 * Transition a user to the Manager role when they start a demo.
 * @param {string} userDocId - The Firestore document ID of the user.
 */
export async function startDemoAsManager(userDocId) {
  if (!userDocId) throw new Error("User Document ID is required.");

  const notification = {
    id: Math.random().toString(36).substring(2, 9),
    title: "Role Assigned",
    message: "You have been assigned as a Manager after starting a demo.",
    read: false,
    type: "role_update",
    senderEmail: "System",
    createdAt: Date.now(),
  };

  const userRef = doc(db, "users", userDocId);
  await updateDoc(userRef, {
    role: "manager",
    notifications: arrayUnion(notification),
  });
}

/**
 * Allows a Manager to add a Field Officer by email.
 * Finds the user with the matching email and updates their role.
 * @param {string} managerUid - The UID of the manager adding the officer.
 * @param {string} officerEmail - The email of the officer to add.
 * @returns {Promise<boolean>} - True if officer was added, false if user not found.
 */
export async function addFieldOfficer(managerUid, officerEmail, managerEmail) {
  if (!managerUid) throw new Error("Manager UID is required.");
  if (!officerEmail) throw new Error("Officer email is required.");

  const normalizedEmail = officerEmail.trim().toLowerCase();

  const q = query(
    collection(db, "users"),
    where("email", "==", normalizedEmail),
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return false; // User not found
  }

  const officerDoc = querySnapshot.docs[0];
  const officerData = officerDoc.data();
  if (officerData && officerData.isDeleted) {
    return false; // Treat as not found / cannot add a deleted user
  }

  // Update the target user's role to 'field_officer' and set relation
  const notification = {
    id: Math.random().toString(36).substring(2, 9),
    title: "Role Assigned",
    message: `You have been assigned as a Field Officer by ${managerEmail || "Manager"}.`,
    read: false,
    type: "role_update",
    senderEmail: managerEmail || "Manager",
    createdAt: Date.now(),
  };

  await updateDoc(officerDoc.ref, {
    role: "field_officer",
    addedByManagerId: managerUid,
    notifications: arrayUnion(notification),
  });

  return true;
}

/**
 * Toggle history page access eligibility for a user.
 * @param {string} userDocId - The Firestore document ID of the user.
 * @param {boolean} canView - Access status.
 */
export async function toggleHistoryAccess(userDocId, canView) {
  if (!userDocId) throw new Error("User Document ID is required.");

  const userRef = doc(db, "users", userDocId);
  await updateDoc(userRef, {
    canViewHistory: canView,
  });
}

/**
 * Manually update a user's role (Admin panel action).
 * @param {string} userDocId - The Firestore document ID of the user.
 * @param {string} newRole - The role to assign.
 */
export async function updateUserRole(
  userDocId,
  newRole,
  targetEmail,
  adminEmail,
) {
  if (!userDocId) throw new Error("User Document ID is required.");
  if (!newRole) throw new Error("New role is required.");

  const userRef = doc(db, "users", userDocId);

  const roleLabels = {
    admin: "Admin",
    manager: "Manager",
    field_officer: "Field Officer",
    user: "Regular User",
  };

  const roleLabel = roleLabels[newRole] || newRole;

  const notification = {
    id: Math.random().toString(36).substring(2, 9),
    title: "Role Assigned",
    message: `You have been assigned as a ${roleLabel} by Admin (${adminEmail || "Admin"}).`,
    read: false,
    type: "role_update",
    senderEmail: adminEmail || "Admin",
    createdAt: Date.now(),
  };

  await updateDoc(userRef, {
    role: newRole,
    notifications: arrayUnion(notification),
  });
}

/**
 * Creates a new user in Firebase Auth and adds their profile to Firestore.
 * If Firestore write fails, deletes the created Auth user to roll back.
 * @param {string} username - User's display name.
 * @param {string} email - User's email address.
 * @param {string} password - User's login password.
 * @param {string} role - User's role.
 */
export async function createNewUser(username, email, password, role) {
  if (!username) throw new Error("Username is required.");
  if (!email) throw new Error("Email is required.");
  if (!password) throw new Error("Password is required.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  let secondaryApp;
  if (getApps().some((a) => a.name === "secondary")) {
    secondaryApp = getApp("secondary");
  } else {
    secondaryApp = initializeApp(firebaseConfig, "secondary");
  }
  const secondaryAuth = getAuth(secondaryApp);

  let userCredential = null;
  try {
    userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email.trim(),
      password
    );
    const authUser = userCredential.user;

    const newUserProfile = {
      uid: authUser.uid,
      email: email.trim().toLowerCase(),
      username: username.trim(),
      role: role,
      canViewHistory: role === "admin",
      notifications: [],
      createdAt: new Date().toISOString(),
    };

    await addDoc(collection(db, "users"), newUserProfile);
    await secondarySignOut(secondaryAuth);
    return true;
  } catch (error) {
    if (userCredential && userCredential.user) {
      try {
        await userCredential.user.delete();
      } catch (deleteError) {
        console.error("Failed to delete auth user during rollback:", deleteError);
      }
      await secondarySignOut(secondaryAuth);
    }
    throw error;
  }
}

/**
 * Soft delete a user by setting isDeleted to true.
 * @param {string} userDocId - The Firestore document ID of the user.
 */
export async function softDeleteUser(userDocId) {
  if (!userDocId) throw new Error("User Document ID is required.");

  const userRef = doc(db, "users", userDocId);
  await updateDoc(userRef, {
    isDeleted: true,
  });
}
