const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.createUser = functions.https.onCall(async (data, context) => {
  // Ensure caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Request must be authenticated",
    );
  }

  const callerUid = context.auth.uid;
  const usersRef = admin.firestore().collection("users");

  // Verify caller is admin by checking Firestore user doc role.
  // Support both doc ID = uid and documents with a separate uid field.
  let callerData = null;

  const callerDoc = await usersRef.doc(callerUid).get();
  if (callerDoc.exists) {
    callerData = callerDoc.data();
  } else {
    const callerQuery = await usersRef
      .where("uid", "==", callerUid)
      .limit(1)
      .get();
    if (!callerQuery.empty) {
      callerData = callerQuery.docs[0].data();
    }
  }

  if (!callerData || callerData.role !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can create users",
    );
  }

  const { email, username, role, canViewHistory, password } = data || {};
  if (!email || !password) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Email and password are required",
    );
  }
  if (typeof password !== "string" || password.length < 6) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Password must be at least 6 characters long",
    );
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // Check if user already exists by email
  try {
    const existing = await admin.auth().getUserByEmail(normalizedEmail);
    if (existing) {
      throw new functions.https.HttpsError(
        "already-exists",
        "User with this email already exists",
      );
    }
  } catch (err) {
    if (err.code && err.code !== "auth/user-not-found") {
      console.error("error checking user by email", err);
      throw new functions.https.HttpsError(
        "internal",
        "Error checking existing users",
      );
    }
    // if user-not-found, continue
  }

  try {
    const userRecord = await admin.auth().createUser({
      email: normalizedEmail,
      password,
      displayName: username || undefined,
    });

    const profile = {
      uid: userRecord.uid,
      email: normalizedEmail,
      username: username || "",
      displayName: username || "",
      role: role || "user",
      canViewHistory: !!canViewHistory,
      createdAt: Date.now(),
      notifications: [],
    };

    await admin
      .firestore()
      .collection("users")
      .doc(userRecord.uid)
      .set(profile);

    return { created: true, uid: userRecord.uid };
  } catch (err) {
    console.error("createUser error:", err);
    throw new functions.https.HttpsError(
      "internal",
      err.message || "Failed to create user",
    );
  }
});
