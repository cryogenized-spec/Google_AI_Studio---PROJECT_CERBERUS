
import { db } from './organizerDb';
import { CharacterProfile, CharacterSheet, CharacterProgression, EasterEggArc, RelationStance } from '../types';
import { TEMPLATES } from '../data/templates';
import { v4 as uuidv4 } from 'uuid';

// --- FACTORY ---

export const instantiateTemplate = async (templateId: string): Promise<CharacterProfile> => {
    const tpl = TEMPLATES.find(t => t.id === templateId);
    if (!tpl) throw new Error("Template not found");

    const newChar: CharacterProfile = {
        id: uuidv4(),
        isTemplate: false,
        templateId: tpl.id,
        name: tpl.name,
        portraitUrl: tpl.portraitUrl,
        theme: { ...tpl.theme },
        progression: {
            affinity: 20, // Start low/neutral
            trust: 10,    // Start cautious
            bondLevel: 0,
            badges: [],
            arcProgress: {}
        },
        // Copy strict constraints
        constraints: { ...tpl.constraints },
        capabilities: { ...tpl.capabilities },
        roles: { ...tpl.roles },
        
        systemPrompt: tpl.systemPrompt, // Legacy fallback
        mappingLogic: tpl.mappingLogic,
        createdAt: Date.now(),
        lastUsedAt: Date.now()
    };

    await db.characters.add(newChar);
    return newChar;
};

// --- READ / LIST ---

export const getTemplateSummaries = () => {
    return TEMPLATES.map(t => ({
        id: t.id,
        name: t.name,
        archetype: t.archetype,
        portraitUrl: t.portraitUrl
    }));
};

export const getUserCharacters = async (): Promise<CharacterProfile[]> => {
    if (!db || !db.characters) return [];
    return await db.characters.toArray();
};

export const getCharacter = async (id: string): Promise<CharacterProfile | undefined> => {
    return await db.characters.get(id);
};

// --- PROGRESSION & SECRETS ---

const BOND_THRESHOLDS = [0, 20, 45, 70, 90, 100]; // Levels 0-5

export const calculateBondLevel = (affinity: number, trust: number): number => {
    const average = (affinity + trust) / 2;
    // Find highest threshold exceeded
    for (let i = BOND_THRESHOLDS.length - 1; i >= 0; i--) {
        if (average >= BOND_THRESHOLDS[i]) return i;
    }
    return 0;
};

// Returns a narrative text payload if a secret is revealed
export const checkSecrets = async (
    char: CharacterProfile, 
    userMessage: string
): Promise<string | null> => {
    if (!char.templateId) return null; // No template = no predefined secrets
    const tpl = TEMPLATES.find(t => t.id === char.templateId);
    if (!tpl || !tpl.secrets) return null;

    let hasUpdates = false;
    let revealPayload: string | null = null;
    const newProgression = { ...char.progression };

    for (const arc of tpl.secrets) {
        // Skip if already revealed
        if (newProgression.arcProgress[arc.id]?.isRevealed) continue;

        // Check bond req
        if (newProgression.bondLevel < arc.requiredBondLevel) continue;

        // Check triggers
        const matches = arc.triggers.some(t => userMessage.toLowerCase().includes(t.toLowerCase()));
        if (matches) {
            // Init arc state if needed
            if (!newProgression.arcProgress[arc.id]) {
                newProgression.arcProgress[arc.id] = { probeCount: 0, isRevealed: false, lastProbeAt: 0 };
            }

            // Update stats
            const state = newProgression.arcProgress[arc.id];
            state.probeCount += 1;
            state.lastProbeAt = Date.now();
            hasUpdates = true;

            // REVEAL LOGIC (Simple for now: 1 probe is enough if bond met)
            // In a complex app, we might require probeCount >= 3
            if (state.probeCount >= 1) {
                state.isRevealed = true;
                newProgression.badges.push(arc.rewardBadge);
                revealPayload = `[SYSTEM: Secret Discovered - ${arc.title}]\n\n${arc.revealText}`;
            }
        }
    }

    if (hasUpdates) {
        await db.characters.update(char.id, { progression: newProgression });
    }

    return revealPayload;
};
