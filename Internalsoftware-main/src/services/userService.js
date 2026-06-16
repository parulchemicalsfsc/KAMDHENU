import { db } from "../firebase";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
} from "firebase/firestore";

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

  // Update the target user's role to 'field_officer' and set relation
  const officerDoc = querySnapshot.docs[0];
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
