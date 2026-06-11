import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

/**
 * Marks a notification as read inside the user's document.
 * @param {string} userDocId - The Firestore document ID of the user.
 * @param {Array} allNotifications - The full notifications array of the user.
 * @param {string} notificationId - The ID of the notification to mark read.
 */
export async function markNotificationAsRead(userDocId, allNotifications, notificationId) {
  if (!userDocId || !allNotifications) return;
  try {
    const userRef = doc(db, 'users', userDocId);
    const updated = allNotifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    );
    await updateDoc(userRef, {
      notifications: updated
    });
  } catch (err) {
    console.error("Failed to mark notification as read:", err);
  }
}

/**
 * Marks all notifications as read inside the user's document.
 * @param {string} userDocId - The Firestore document ID of the user.
 * @param {Array} allNotifications - The full notifications array of the user.
 */
export async function markAllNotificationsAsRead(userDocId, allNotifications) {
  if (!userDocId || !allNotifications) return;
  try {
    const userRef = doc(db, 'users', userDocId);
    const updated = allNotifications.map(n => ({ ...n, read: true }));
    await updateDoc(userRef, {
      notifications: updated
    });
  } catch (err) {
    console.error("Failed to mark all notifications as read:", err);
  }
}
