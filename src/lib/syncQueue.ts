import { supabase } from "@/integrations/supabase/client";

/**
 * Cola local de sincronización para zonas con poca señal.
 * Guarda las escrituras pendientes en IndexedDB (con respaldo en localStorage)
 * y las reintenta automáticamente cuando vuelve la conexión.
 */

export type PendingOp = {
  id: string;
  table: string;
  op: "insert" | "update" | "delete";
  payload?: Record<string, any>;
  match?: Record<string, any>;
  label: string;
  createdAt: number;
  tries: number;
};

const DB_NAME = "hogarfin-sync";
const STORE = "pending";
const LS_KEY = "hogarfin_sync_queue";

function hasIDB() {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function lsRead(): PendingOp[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function lsWrite(list: PendingOp[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {}
}

export async function readQueue(): Promise<PendingOp[]> {
  if (!hasIDB()) return lsRead();
  try {
    const db = await openDB();
    return await new Promise<PendingOp[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as PendingOp[]).sort((a, b) => a.createdAt - b.createdAt));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return lsRead();
  }
}

async function putOp(op: PendingOp) {
  if (!hasIDB()) return lsWrite([...lsRead().filter((x) => x.id !== op.id), op]);
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(op);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    lsWrite([...lsRead().filter((x) => x.id !== op.id), op]);
  }
}

async function deleteOp(id: string) {
  if (!hasIDB()) return lsWrite(lsRead().filter((x) => x.id !== id));
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    lsWrite(lsRead().filter((x) => x.id !== id));
  }
}

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

export function onQueueChange(fn: Listener) {
  listeners.add(fn);
  readQueue().then((q) => fn(q.length));
  return () => listeners.delete(fn);
}

async function notify() {
  const q = await readQueue();
  listeners.forEach((l) => l(q.length));
}

export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

async function run(op: PendingOp) {
  const table = supabase.from(op.table as any);
  if (op.op === "insert") return await (table as any).insert(op.payload);
  let q: any = op.op === "update" ? (table as any).update(op.payload) : (table as any).delete();
  Object.entries(op.match ?? {}).forEach(([k, v]) => { q = q.eq(k, v); });
  return await q;
}

/**
 * Ejecuta la escritura de inmediato; si no hay conexión (o la red falla),
 * la deja en la cola local y la reintenta al recuperar la señal.
 * Devuelve `{ queued: true }` cuando quedó pendiente.
 */
export async function queuedWrite(
  input: Omit<PendingOp, "id" | "createdAt" | "tries">,
): Promise<{ error: any; queued: boolean }> {
  const op: PendingOp = { ...input, id: crypto.randomUUID(), createdAt: Date.now(), tries: 0 };
  if (isOffline()) {
    await putOp(op);
    await notify();
    return { error: null, queued: true };
  }
  try {
    const { error } = (await run(op)) as any;
    if (error) return { error, queued: false };
    return { error: null, queued: false };
  } catch {
    await putOp(op);
    await notify();
    return { error: null, queued: true };
  }
}

let flushing = false;

/** Reintenta todas las operaciones pendientes. Devuelve cuántas se sincronizaron. */
export async function flushQueue(): Promise<number> {
  if (flushing || isOffline()) return 0;
  flushing = true;
  let done = 0;
  try {
    const pending = await readQueue();
    for (const op of pending) {
      try {
        const { error } = (await run(op)) as any;
        if (error) {
          // Error de datos (no de red): se descarta tras varios intentos.
          if (op.tries >= 3) await deleteOp(op.id);
          else await putOp({ ...op, tries: op.tries + 1 });
          continue;
        }
        await deleteOp(op.id);
        done++;
      } catch {
        break; // sigue sin red
      }
    }
  } finally {
    flushing = false;
    await notify();
  }
  return done;
}
