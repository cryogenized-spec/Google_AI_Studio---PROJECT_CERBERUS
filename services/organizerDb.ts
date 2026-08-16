import Dexie, { Table } from 'dexie';
import { OrgTask, OrgEvent, OrgNote, OrgNotebook, AssistantMessage, ActionProposal, QuickPreset, StoredSecret, CharacterProfile } from '../types';

export class OrganizerDB extends Dexie {
    tasks!: Table<OrgTask>;
    events!: Table<OrgEvent>;
    notes!: Table<OrgNote>;
    notebooks!: Table<OrgNotebook>;
    assistant_messages!: Table<AssistantMessage>;
    planning_context!: Table<any>;
    quick_presets!: Table<QuickPreset>;
    secrets!: Table<StoredSecret>;
    characters!: Table<CharacterProfile>;

    constructor() {
        super('OrganizerDB');

        // Version 12: Secrets update
        this.version(12).stores({
            tasks: '++id, status, dueAt, listId, priority, [status+dueAt]',
            events: '++id, startAt, endAt, [startAt+endAt]',
            notes: 'id, type, title, pinned, archived, notebookId, *tags, remindAt, updatedAt, [pinned+updatedAt]',
            notebooks: 'id, name, updatedAt',
            lists: '++id, name, sortOrder',
            tags: '++id, name',
            assistant_messages: '++id, role, createdAt, mode',
            planning_context: 'id',
            outbox: '++id, timestamp, synced',
            archived_items: 'id, originalTable, archivedAt',
            quick_presets: 'id',
            secrets: 'id, provider, mode',
            characters: 'id, templateId, lastUsedAt'
        });
    }
}

export const db = new OrganizerDB();

/**
 * Wait until Dexie is open and the secrets table is queryable.
 * Returns true on success, false after timeout / failure.
 */
export async function ensureDbReady(timeoutMs = 4000): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        try {
            // Force open if needed
            if (!db.isOpen()) {
                await db.open();
            }
            // Light probe – secrets table must be readable
            await db.secrets.limit(1).toArray();
            return true;
        } catch (err) {
            console.warn('[Cerberus DB] Not ready yet, retrying…', err);
            await new Promise(r => setTimeout(r, 250));
        }
    }

    console.error('[Cerberus DB] ensureDbReady timed out');
    return false;
}

/**
 * Safe secrets read used by the boot path.
 * Never throws – returns empty array on any failure.
 */
export async function safeSecretsQuery(): Promise<StoredSecret[]> {
    try {
        const ready = await ensureDbReady();
        if (!ready) return [];
        return await db.secrets.toArray();
    } catch (err) {
        console.error('[Cerberus DB] safeSecretsQuery failed:', err);
        return [];
    }
}

export const initializeOrganizer = async () => {
    try {
        await ensureDbReady();

        if ((await db.quick_presets.count()) === 0) {
            await db.quick_presets.add({
                id: 'default',
                name: 'Standard Dashboard',
                layout: [
                    { id: 'mic', type: 'mic' },
                    { id: 'today', type: 'today_list' },
                    { id: 'next', type: 'next_event' }
                ],
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        }

        if ((await db.planning_context.count()) === 0) {
            await db.planning_context.put({
                id: 'default',
                workHours: '09:00-17:00',
                sleepWindow: '23:00-07:00',
                preferences: 'Avoid meetings on Friday afternoons.',
                privacy: { allowTasks: true, allowCalendar: true }
            });
        }
    } catch (err) {
        console.error('[Cerberus DB] initializeOrganizer failed:', err);
    }
};

export const exportOrganizerData = async () => {
    const data: any = {};
    // @ts-ignore
    const tables = db.tables;
    for (const table of tables) {
        data[table.name] = await table.toArray();
    }
    return JSON.stringify(data);
};

export const importOrganizerData = async (json: string) => {
    const data = JSON.parse(json);
    // @ts-ignore
    await db.transaction('rw', db.tables, async () => {
        for (const tableName of Object.keys(data)) {
            // @ts-ignore
            const table = db.table(tableName);
            if (table) {
                await table.clear();
                await table.bulkAdd(data[tableName]);
            }
        }
    });
};

export const requestPersistentStorage = async () => {
    if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persisted();
        if (!isPersisted) {
            await navigator.storage.persist();
        }
    }
};

export const archiveOldTasks = async (monthsOld: number) => {
    const cutoff = Date.now() - (monthsOld * 30 * 24 * 60 * 60 * 1000);
    const oldTasks = await db.tasks.where('status').equals('done').filter(t => t.updatedAt < cutoff).toArray();

    if (oldTasks.length > 0) {
        await db.tasks.bulkDelete(oldTasks.map(t => t.id));
    }
};
