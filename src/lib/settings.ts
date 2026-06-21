import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { encrypt, decrypt } from "./encryption";

export interface AppSettings {
  GEMINI_API_KEY?: string;
  DEVTO_API_KEY?: string;
  HASHNODE_API_TOKEN?: string;
  HASHNODE_PUBLICATION_ID?: string;
  RAPIDAPI_KEY?: string;
  MEDIUM_USER_ID?: string;
}

/**
 * Fetches settings from Firestore and decrypts the sensitive fields.
 */
export async function getSettings(userId: string): Promise<AppSettings> {
  const docSnap = await adminDb.collection("settings").doc(userId).get();
  if (!docSnap.exists) {
    return {};
  }
  
  const data = docSnap.data() as AppSettings;
  const decrypted: AppSettings = {};
  
  // Decrypt each value if it exists
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "string") {
      try {
        decrypted[key as keyof AppSettings] = decrypt(value);
      } catch (err) {
        console.error(`Failed to decrypt setting for ${key}`);
      }
    }
  }
  
  return decrypted;
}

/**
 * Encrypts provided settings and saves them to Firestore.
 * Values that are explicitly passed as empty strings will be deleted.
 * Values that are undefined are ignored (not updated).
 */
export async function saveSettings(userId: string, updates: Partial<AppSettings>): Promise<void> {
  const docRef = adminDb.collection("settings").doc(userId);
  const encryptedUpdates: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(updates)) {
    if (value === "") {
      // Allow user to clear a setting by passing empty string
      encryptedUpdates[key] = FieldValue.delete();
    } else if (value && typeof value === "string") {
      encryptedUpdates[key] = encrypt(value);
    }
  }
  
  if (Object.keys(encryptedUpdates).length > 0) {
    await docRef.set(encryptedUpdates, { merge: true });
  }
}
