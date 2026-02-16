
import Dexie, { Table } from 'dexie';
import { OrgTask, OrgEvent, OrgNote, OrgList, OrgTag, AssistantMessage, PlanningContext, OutboxEvent, ArchivedItem, QuickPreset, StoredSecret } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class OrganizerDB extends Dexie {
    tasks!: Table<OrgTask>;
    events!: Table<OrgEvent>;
    notes!: Table<OrgNote>;
    lists!: Table<OrgList>;
    tags!: Table<OrgTag>;
    assistant_messages!: Table<AssistantMessage>;
    planning_context!: Table<PlanningContext>;
    outbox!: Table<OutboxEvent>;
    archived_items!: Table<ArchivedItem>;
    quick_presets!: Table<QuickPreset>;
    secrets!: Table<StoredSecret>;

    constructor() {
        super('OrganizerDB');
        
        try {
            // @ts-ignore
            this.version(1).stores({
                tasks: '++id, status, dueAt, listId, priority, [status+dueAt]',
                events: '++id, startAt, endAt, [startAt+endAt]',
                notes: '++id, pinned, createdAt',
                lists: '++id, name, sortOrder',
                tags: '++id, name'
            });

            // @ts-ignore
            this.version(2).stores({
                assistant_messages: '++id, role, createdAt, mode',
                planning_context: 'id'
            });

            // @ts-ignore
            this.version(3).stores({
                outbox: '++id, timestamp, synced',
                archived_items: 'id, originalTable, archivedAt'
            });
            
            // @ts-ignore
            this.version(4).stores({
                quick_presets: 'id'
            });

            // @ts-ignore
            this.version(5).stores({
                secrets: 'id'
            });
        } catch (e) {
            console.error("Dexie Schema Error:", e);
        }
    }
}

// Safely instantiate DB
let dbInstance: OrganizerDB;
try {
    dbInstance = new OrganizerDB();
} catch (e) {
    console.error("CRITICAL: Failed to create OrganizerDB instance.", e);
    // Fallback to avoid module crash, though functionality will be broken
    dbInstance = new Dexie('FallbackDB') as OrganizerDB; 
}

export const db = dbInstance;

// Register hooks safely
const registerHooks = () => {
    try {
        const tablesToMonitor = ['tasks', 'events', 'notes', 'lists', 'tags', 'planning_context'];
        
        tablesToMonitor.forEach(tableName => {
            const table = (db as any)[tableName] as Table<any, any>;
            if (!table) return;

            table.hook('creating', (primKey, obj) => {
                db.outbox.add({
                    id: uuidv4(),
                    table: tableName,
                    action: 'create',
                    data: obj,
                    timestamp: Date.now(),
                    synced: false
                });
            });

            table.hook('updating', (mods, primKey, obj) => {
                db.outbox.add({
                    id: uuidv4(),
                    table: tableName,
                    action: 'update',
                    data: { id: primKey, ...mods },
                    timestamp: Date.now(),
                    synced: false
                });
            });

            table.hook('deleting', (primKey) => {
                db.outbox.add({
                    id: uuidv4(),
                    table: tableName,
                    action: 'delete',
                    data: { id: primKey },
                    timestamp: Date.now(),
                    synced: false
                });
            });
        });
    } catch(e) {
        console.warn("OrganizerDB Hook Setup Warning:", e);
    }
};

let isInitialized = false;

export const initializeOrganizer = async () => {
    if (isInitialized) return;
    
    try {
        // Fix TS Error: isOpen/open not on type
        if (!(db as any).isOpen()) {
            await (db as any).open();
        }
        
        registerHooks();
        isInitialized = true;
        
        // Seed Defaults
        const count = await db.lists.count();
        if (count === 0) {
            await db.lists.bulkAdd([
                { id: 'inbox', name: 'Inbox', sortOrder: 0, createdAt: Date.now() },
                { id: 'personal', name: 'Personal', sortOrder: 1, createdAt: Date.now() },
                { id: 'work', name: 'Work', sortOrder: 2, createdAt: Date.now() }
            ]);
        }

        const contextCount = await db.planning_context.count();
        if (contextCount === 0) {
            await db.planning_context.put({
                id: 'default',
                workHours: '09:00-17:00',
                sleepWindow: '23:00-07:00',
                preferences: '',
                privacy: { allowCalendar: true, allowTasks: true, allowNotes: true },
                updatedAt: Date.now()
            });
        }
        
        const presetCount = await db.quick_presets.count();
        if (presetCount === 0) {
            await db.quick_presets.put({
                id: 'default',
                name: 'Default',
                layout: [
                    { id: 'mic_main', type: 'mic', size: 'large' },
                    { id: 'today_summary', type: 'today_list', size: 'medium' }
                ],
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        }
    } catch (e) {
        console.error("DB Init Failed", e);
    }
};

export const requestPersistentStorage = async (): Promise<boolean> => {
    if (navigator.storage && navigator.storage.persist) {
        try {
            return await navigator.storage.persist();
        } catch(e) {
            return false;
        }
    }
    return false;
};

export const checkStorageEstimate = async () => {
    if (navigator.storage && navigator.storage.estimate) {
        try {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage || 0,
                quota: estimate.quota || 0,
                percent: estimate.usage && estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0
            };
        } catch(e) { return null; }
    }
    return null;
};

export const archiveOldTasks = async (monthsToKeep: number) => {
    if (monthsToKeep <= 0) return;
    const cutoff = Date.now() - (monthsToKeep * 30 * 24 * 60 * 60 * 1000);
    try {
        // Fix TS Error: transaction not on type
        await (db as any).transaction('rw', db.tasks, db.archived_items, async () => {
            const oldTasks = await db.tasks
                .where('status').equals('done')
                .filter(t => t.completedAt ? t.completedAt < cutoff : t.updatedAt < cutoff)
                .toArray();

            if (oldTasks.length > 0) {
                const archiveEntries = oldTasks.map(t => ({
                    id: t.id,
                    originalTable: 'tasks',
                    data: t,
                    archivedAt: Date.now()
                }));
                await db.archived_items.bulkAdd(archiveEntries);
                await db.tasks.bulkDelete(oldTasks.map(t => t.id));
            }
        });
    } catch (e) { console.error("Archive Failed", e); }
};

export const exportOrganizerData = async (): Promise<string> => {
    try {
        const data = {
            tasks: await db.tasks.toArray(),
            events: await db.events.toArray(),
            notes: await db.notes.toArray(),
            lists: await db.lists.toArray(),
            tags: await db.tags.toArray(),
            assistant_messages: await db.assistant_messages.toArray(),
            planning_context: await db.planning_context.toArray(),
            quick_presets: await db.quick_presets.toArray(),
            exportedAt: Date.now(),
            version: 3
        };
        return JSON.stringify(data, null, 2);
    } catch (e) {
        return "{}";
    }
};

export const importOrganizerData = async (jsonStr: string, merge: boolean = false) => {
    try {
        const data = JSON.parse(jsonStr);
        if (!data.version || !data.tasks) throw new Error("Invalid Format");

        // Fix TS Error: transaction not on type
        await (db as any).transaction('rw', db.tasks, db.events, db.notes, db.lists, db.tags, db.assistant_messages, db.planning_context, db.quick_presets, async () => {
            if (!merge) {
                await Promise.all([
                    db.tasks.clear(), db.events.clear(), db.notes.clear(),
                    db.lists.clear(), db.tags.clear(), db.assistant_messages.clear(),
                    db.planning_context.clear(), db.quick_presets.clear()
                ]);
            }
            if (data.tasks) await db.tasks.bulkPut(data.tasks);
            if (data.events) await db.events.bulkPut(data.events);
            if (data.notes) await db.notes.bulkPut(data.notes);
            if (data.lists) await db.lists.bulkPut(data.lists);
            if (data.tags) await db.tags.bulkPut(data.tags);
            if (data.assistant_messages) await db.assistant_messages.bulkPut(data.assistant_messages);
            if (data.planning_context) await db.planning_context.bulkPut(data.planning_context);
            if (data.quick_presets) await db.quick_presets.bulkPut(data.quick_presets);
        });
        return true;
    } catch (e) {
        console.error("Import Failed", e);
        throw e;
    }
};
