import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs,
  DocumentData,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "./client";

export const ideasRef = () => collection(db, "ideas");
export const articlesRef = () => collection(db, "articles");
export const publicationsRef = () => collection(db, "publications");
export const promptTemplatesRef = () => collection(db, "promptTemplates");

export async function getDocById<T extends DocumentData>(
  collectionName: string,
  id: string
): Promise<T | null> {
  const snap = await getDoc(doc(db, collectionName, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as unknown as T;
}

export async function queryDocs<T extends DocumentData>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(collection(db, collectionName), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T);
}

export async function createDoc<T extends DocumentData>(
  collectionName: string,
  id: string,
  data: Omit<T, "id" | "createdAt" | "updatedAt">
): Promise<void> {
  await setDoc(doc(db, collectionName, id), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateDocById(
  collectionName: string,
  id: string,
  data: Partial<DocumentData>
): Promise<void> {
  await updateDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export function getWeekId(date: Date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function ideasByWeek(userId: string, weekId: string) {
  return [
    where("userId", "==", userId),
    where("weekId", "==", weekId),
    orderBy("createdAt", "desc"),
  ] as QueryConstraint[];
}

export function allIdeasForDedup(userId: string) {
  return [
    where("userId", "==", userId),
  ] as QueryConstraint[];
}

export function articlesByWeek(userId: string, weekId: string) {
  return [
    where("userId", "==", userId),
    where("weekId", "==", weekId),
  ] as QueryConstraint[];
}
