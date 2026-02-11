import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, query, where, orderBy, limit, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { AppSettings, MemoryCard, ScriptoriumItem, ChatState, ScheduleSettings, RuntimeSettings, MemoryPolicy, ToolSettings, DailyPingState, WakeLog } from '../types';
import { DEFAULT_RUNTIME_SETTINGS, DEFAULT_SCHEDULE_SETTINGS, DEFAULT_MEMORY_POLICY, DEFAULT_TOOL_SETTINGS } from '../constants';

let db: any;
let auth: any;

export const initializeFirebase = async (settings: AppSettings) => {
    if (!settings.firebaseConfig || !settings.firebaseConfig.apiKey) return null;

    try {
        const app = !getApps().length 
            ? initializeApp(settings.firebaseConfig) 
            : getApp();
        
        db = getFirestore(app);
        auth = getAuth(app);
        
        // Ensure auth
        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }
        
        return auth.currentUser.uid;
    } catch (e) {
        console.error("Firebase Init Error:", e);
        return null;
    }
};

const getUid = () => auth?.currentUser?.uid;

// --- MEMORY OPERATIONS ---

export const saveMemory = async (memory: Partial<MemoryCard>) => {
    const uid = getUid();
    if (!uid || !db) return;

    const newMem: MemoryCard = {
        id: memory.id || doc(collection(db, `users/${uid}/memories`)).id,
        domain: memory.domain || 'utility',
        text: memory.text || '',
        importance: memory.importance || 1,
        confidence: memory.confidence || 1.0,
        ttlDays: memory.ttlDays ?? 30, // Default 30 days
        status: memory.status || 'active',
        createdAt: memory.createdAt || Date.now(),
        lastUsedAt: Date.now(),
        lastConfirmedAt: memory.lastConfirmedAt
    };

    await setDoc(doc(db, `users/${uid}/memories/${newMem.id}`), newMem);
    return newMem;
};

export const fetchActiveMemories = async (): Promise<MemoryCard[]> => {
    const uid = getUid();
    if (!uid || !db) return [];

    const q = query(
        collection(db, `users/${uid}/memories`),
        where('status', '==', 'active'),
        orderBy('importance', 'desc'),
        limit(50) 
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as MemoryCard);
};

export const updateMemory = async (id: string, updates: Partial<MemoryCard>) => {
    const uid = getUid();
    if (!uid || !db) return;
    await updateDoc(doc(db, `users/${uid}/memories/${id}`), updates);
};

// --- SCRIPTORIUM ITEMS ---

export const saveScriptoriumItem = async (item: Partial<ScriptoriumItem>) => {
    const uid = getUid();
    if (!uid || !db) return;

    const newItem: ScriptoriumItem = {
        id: item.id || doc(collection(db, `users/${uid}/scriptorium/items`)).id,
        type: item.type || 'note',
        title: item.title || 'New Item',
        details: item.details || '',
        priority: item.priority || 3,
        status: item.status || 'open',
        createdAt: item.createdAt || Date.now(),
        dueAt: item.dueAt,
        links: item.links || []
    };

    await setDoc(doc(db, `users/${uid}/scriptorium/items/${newItem.id}`), newItem);
    return newItem;
};

export const fetchOpenScriptoriumItems = async (): Promise<ScriptoriumItem[]> => {
    const uid = getUid();
    if (!uid || !db) return [];

    const q = query(
        collection(db, `users/${uid}/scriptorium/items`),
        where('status', '==', 'open'),
        orderBy('priority', 'desc'),
        limit(50)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as ScriptoriumItem);
};

export const updateScriptoriumItem = async (id: string, updates: Partial<ScriptoriumItem>) => {
    const uid = getUid();
    if (!uid || !db) return;
    await updateDoc(doc(db, `users/${uid}/scriptorium/items/${id}`), updates);
};

// --- SETTINGS MANAGEMENT ---

export const fetchSettings = async (type: 'runtime' | 'schedule' | 'memoryPolicy' | 'tools'): Promise<any> => {
    const uid = getUid();
    if (!uid || !db) return null;
    
    const snap = await getDoc(doc(db, `users/${uid}/settings/${type}`));
    if (snap.exists()) return snap.data();
    
    // Return defaults if not found
    switch(type) {
        case 'runtime': return DEFAULT_RUNTIME_SETTINGS;
        case 'schedule': return DEFAULT_SCHEDULE_SETTINGS;
        case 'memoryPolicy': return DEFAULT_MEMORY_POLICY;
        case 'tools': return DEFAULT_TOOL_SETTINGS;
        default: return null;
    }
};

export const saveSettings = async (type: 'runtime' | 'schedule' | 'memoryPolicy' | 'tools', data: any) => {
    const uid = getUid();
    if (!uid || !db) return;
    await setDoc(doc(db, `users/${uid}/settings/${type}`), data);
};

// --- WAKE CYCLE DATA ---

export const fetchUserTimestamps = async () => {
    const uid = getUid();
    if (!uid || !db) return null;
    const snap = await getDoc(doc(db, `users/${uid}`));
    if (snap.exists()) {
        const d = snap.data();
        return {
            lastInteractionAt: d.lastInteractionAt?.toMillis() || 0,
            lastPingAt: d.lastPingAt?.toMillis() || 0,
            lastWakeAt: d.lastWakeAt?.toMillis() || 0
        };
    }
    return { lastInteractionAt: 0, lastPingAt: 0, lastWakeAt: 0 };
};

export const updateWakeTimestamps = async (timestamps: { lastPingAt?: number; lastWakeAt?: number }) => {
    const uid = getUid();
    if (!uid || !db) return;
    
    const updates: any = {};
    if (timestamps.lastPingAt) updates.lastPingAt = Timestamp.fromMillis(timestamps.lastPingAt);
    if (timestamps.lastWakeAt) updates.lastWakeAt = Timestamp.fromMillis(timestamps.lastWakeAt);
    
    await setDoc(doc(db, `users/${uid}`), updates, { merge: true });
};

// --- LOGGING & GUARDS ---

export const recordWakeLog = async (log: Omit<WakeLog, 'id'>) => {
    const uid = getUid();
    if (!uid || !db) return;
    
    const docRef = doc(collection(db, `users/${uid}/wake_logs`));
    await setDoc(docRef, {
        ...log,
        id: docRef.id
    });
};

export const fetchWakeLogs = async (limitCount = 20): Promise<WakeLog[]> => {
    const uid = getUid();
    if (!uid || !db) return [];
    
    const q = query(
        collection(db, `users/${uid}/wake_logs`),
        orderBy('ts', 'desc'),
        limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as WakeLog);
};

export const getDailyPingState = async (dateStr: string): Promise<DailyPingState> => {
    const uid = getUid();
    if (!uid || !db) return { date: dateStr, executedTargetIds: [], count: 0 };
    
    const snap = await getDoc(doc(db, `users/${uid}/daily_ping_state/${dateStr}`));
    if (snap.exists()) {
        return snap.data() as DailyPingState;
    }
    return { date: dateStr, executedTargetIds: [], count: 0 };
};

export const updateDailyPingState = async (dateStr: string, targetId: string) => {
    const uid = getUid();
    if (!uid || !db) return;
    
    const ref = doc(db, `users/${uid}/daily_ping_state/${dateStr}`);
    const snap = await getDoc(ref);
    
    if (snap.exists()) {
        const data = snap.data() as DailyPingState;
        if (!data.executedTargetIds.includes(targetId)) {
            await updateDoc(ref, {
                executedTargetIds: [...data.executedTargetIds, targetId],
                count: (data.count || 0) + 1
            });
        }
    } else {
        await setDoc(ref, {
            date: dateStr,
            executedTargetIds: [targetId],
            count: 1
        });
    }
};

// --- UTILITY ---

export const syncStateToCloud = async (state: ChatState) => {
    const uid = getUid();
    if (!uid || !db) return;
    
    await setDoc(doc(db, `users/${uid}`), {
        moodState: state.moodState,
        lastInteractionAt: Timestamp.fromMillis(state.lastInteractionTimestamp)
    }, { merge: true });
};