import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function POST(request) {
  let createdUserId = null;

  try {
    // --------------------------------------------------
    // 1. Check authorization header
    // --------------------------------------------------
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);

    // --------------------------------------------------
    // 2. Verify Firebase ID token
    // --------------------------------------------------
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const adminUid = decodedToken.uid;

    // --------------------------------------------------
    // 3. Confirm the logged-in user is an admin
    // --------------------------------------------------
    const adminUserRef = adminDb.collection("users").doc(adminUid);
    const adminUserSnap = await adminUserRef.get();

    if (!adminUserSnap.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Admin profile not found.",
        },
        { status: 403 }
      );
    }

    const adminUser = adminUserSnap.data();

    if (adminUser.role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "You do not have permission to create workers.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 4. Read request body
    // --------------------------------------------------
    const body = await request.json();

    const {
      firstName,
      lastName,
      phone,
      employeeId,
      role,
      email,
      password,
    } = body;

    // --------------------------------------------------
    // 5. Validate required fields
    // --------------------------------------------------
    if (
      !firstName ||
      !lastName ||
      !phone ||
      !employeeId ||
      !role ||
      !email ||
      !password
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Please complete all required fields.",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: "The temporary password must be at least 6 characters.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 6. Normalize data
    // --------------------------------------------------
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanPhone = phone.trim();
    const cleanEmployeeId = employeeId.trim();
    const cleanRole = role.trim();
    const cleanEmail = email.trim().toLowerCase();

    const fullName = `${cleanFirstName} ${cleanLastName}`;

    // --------------------------------------------------
    // 7. Create Firebase Authentication account
    // --------------------------------------------------
    const newUser = await adminAuth.createUser({
      email: cleanEmail,
      password,
      displayName: fullName,
    });

    createdUserId = newUser.uid;

    // --------------------------------------------------
    // 8. Create user + worker documents
    // --------------------------------------------------
    const userRef = adminDb.collection("users").doc(newUser.uid);
    const workerRef = adminDb.collection("workers").doc(newUser.uid);

    const timestamp = FieldValue.serverTimestamp();

    const userData = {
      uid: newUser.uid,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      name: fullName,
      email: cleanEmail,
      phone: cleanPhone,
      role: "staff",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const workerData = {
      uid: newUser.uid,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      name: fullName,
      email: cleanEmail,
      phone: cleanPhone,
      role: cleanRole,
      employeeId: cleanEmployeeId,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const batch = adminDb.batch();

    batch.set(userRef, userData);
    batch.set(workerRef, workerData);

    await batch.commit();

    // --------------------------------------------------
    // 9. Return success
    // --------------------------------------------------
    return NextResponse.json(
      {
        success: true,
        message: "Worker created successfully.",
        workerId: newUser.uid,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create worker error:", error);

    // --------------------------------------------------
    // 10. Roll back Auth account if Firestore failed
    // --------------------------------------------------
    if (createdUserId) {
      try {
        await adminAuth.deleteUser(createdUserId);
      } catch (deleteError) {
        console.error(
          "Failed to roll back worker authentication account:",
          deleteError
        );
      }
    }

    // Firebase Auth email already exists
    if (error.code === "auth/email-already-exists") {
      return NextResponse.json(
        {
          success: false,
          error: "A user with this email address already exists.",
        },
        { status: 409 }
      );
    }

    if (error.code === "auth/invalid-password") {
      return NextResponse.json(
        {
          success: false,
          error: "The password does not meet Firebase requirements.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create worker.",
      },
      { status: 500 }
    );
  }
}