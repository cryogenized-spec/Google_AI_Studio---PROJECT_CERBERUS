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
        
        try {
            // Version 12: Secrets update
            // @ts-ignore
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

        } catch (e) {
            console.error("Dexie Schema Definition Error:", e);
        }
    }
}

export const db = new OrganizerDB();

export const initializeOrganizer = async () => {
    // Seeding if empty
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
        // Here we could move them to an 'archived_items' table if implemented
        await db.tasks.bulkDelete(oldTasks.map(t => t.id));
    }
};