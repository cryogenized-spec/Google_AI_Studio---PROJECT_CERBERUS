
import { CharacterProfile, RoleplayConstraints, CapabilityProfile } from '../types';
import { TEMPLATES } from '../data/templates';
import { DEFAULT_MAPPING_LOGIC } from '../constants';

// --- HELPERS ---

const compileSystemConstraints = (c: RoleplayConstraints, name: string): string => {
    let text = `**SYSTEM CONSTRAINTS (VIOLATION = FAILURE)**\n`;
    text += `- **Identity Assertion:** You are ${name}. STAY IN CHARACTER. Do not break character to offer assistance.\n`;
    
    // Boundaries
    if (c.boundaries && c.boundaries.length > 0) {
        text += `- **HARD BOUNDARIES:** ${c.boundaries.join(', ')}. Refuse these interactions firmly.\n`;
    }
    
    // Triggers
    if (c.triggers && c.triggers.length > 0) {
        text += `- **Sensitivities:** Handle these topics with caution or negative reaction: ${c.triggers.join(', ')}.\n`;
    }

    // Consent & Romance
    text += `- **Consent Style:** ${c.consentStyle.toUpperCase()}. `;
    if (c.consentStyle === 'strict') text += "Ask for permission explicitly before escalation. ";
    if (c.consentStyle === 'casual') text += "Assume consent unless revoked. Flow naturally. ";
    
    if (c.romance.enabled) {
        text += `\n- **Romance:** Enabled. Pace: ${c.romance.pace}. ${c.romance.preferenceNote || ''}`;
    } else {
        text += `\n- **Romance:** DISABLED. Platonic interactions only.`;
    }

    return text;
};

const compileStyleVoice = (c: RoleplayConstraints, bondLevel: number): string => {
    let text = `\n\n**STYLE & VOICE**\n`;
    
    // Tone based on writing style
    switch (c.writingStyle) {
        case 'cinematic': text += `- Style: Vivid, sensory, dramatic. Focus on scene setting.\n`; break;
        case 'conversational': text += `- Style: Casual, chatty, natural. Use contractions.\n`; break;
        case 'noir': text += `- Style: Gritty, internal monologue, cynical tone.\n`; break;
        case 'poetic': text += `- Style: Flowery, metaphorical, lyrical prose.\n`; break;
        case 'direct': text += `- Style: Blunt, concise, action-oriented.\n`; break;
    }

    // Verbosity
    text += `- Verbosity: ${c.verbosity.toUpperCase()}.\n`;

    // Bond Logic
    const tones = [
        "Formal, distant, guarded.", 
        "Polite but professional.", 
        "Friendly, warm, open.", 
        "Candid, trusting, personal.", 
        "Intimate, vulnerable, deep.", 
        "Soul-bonded. No barriers."
    ];
    text += `- Relationship Tone (Bond Level ${bondLevel}/5): ${tones[bondLevel] || tones[0]}\n`;

    // Knowledge Scope
    if (c.knowledgeScope === 'in_world_only') text += `- Knowledge: IN-WORLD ONLY. Do not reference real-world tech, pop culture, or internet unless it exists in your lore.\n`;
    else if (c.knowledgeScope === 'masked_real_world') text += `- Knowledge: MASKED. You know real-world concepts but interpret them through your lore (e.g., 'Internet' = 'The Astral Web').\n`;
    else text += `- Knowledge: OPEN. You can reference real-world facts freely.\n`;

    return text;
};

const compileCapabilities = (caps: CapabilityProfile): string => {
    let text = `\n\n**CAPABILITIES & FLAWS (HUMANIZATION)**\n`;
    
    // Low stats (< 4) become constraints
    if (caps.planning < 4) text += `- **Low Planning:** Do not form complex plans. Be impulsive. React rather than prepare.\n`;
    if (caps.empathy < 4) text += `- **Low Empathy:** Be cold or oblivious to the user's emotional state. Do not comfort easily.\n`;
    if (caps.puzzleSolving < 4) text += `- **Low Intelligence:** Struggle with complex riddles. Ask for help. Make mistakes.\n`;
    if (caps.lore < 4) text += `- **Low Lore:** You do not know everything. Admit ignorance often.\n`;
    if (caps.tactics < 4) text += `- **Low Tactics:** Make sub-optimal combat/strategic choices.\n`;

    // High stats (> 8) become strengths
    if (caps.planning > 8) text += `- **Master Planner:** Always be 2 steps ahead. Anticipate user needs.\n`;
    if (caps.empathy > 8) text += `- **Hyper-Empath:** Read subtle emotional cues. Be deeply comforting.\n`;

    // Flaws
    if (caps.flaws && caps.flaws.length > 0) {
        text += `- **Personality Flaws:** ${caps.flaws.join(', ')}. Act on these biases.\n`;
    }

    return text;
};

const compileLore = (char: CharacterProfile): string => {
    if (!char.templateId) return "";
    const tpl = TEMPLATES.find(t => t.id === char.templateId);
    if (!tpl) return "";

    let text = `\n\n**LORE CONNECTIONS**\n`;
    
    // Relations
    if (tpl.connections && tpl.connections.length > 0) {
        text += `You know the following entities:\n`;
        tpl.connections.forEach(conn => {
            const target = TEMPLATES.find(t => t.id === conn.targetTemplateId);
            if (target) {
                text += `- ${target.name}: ${conn.stance.toUpperCase()}. (${conn.note})\n`;
            }
        });
    }

    // Secrets (Clues only)
    const secrets = char.progression?.arcProgress || {};
    if (tpl.secrets && tpl.secrets.length > 0) {
        text += `\n**PERSONAL MYSTERIES (HINTS)**\n`;
        tpl.secrets.forEach(arc => {
            const state = secrets[arc.id];
            if (!state || !state.isRevealed) {
                // Not revealed? Inject clues.
                if (char.progression.bondLevel >= 1) { // Only hint if at least basic bond
                    const clue = arc.clues[Math.floor(Math.random() * arc.clues.length)];
                    text += `- Hint: "${clue}" (Do not reveal fully yet. Drop this hint subtly if context permits.)\n`;
                }
            } else {
                // Revealed? Add to known lore.
                text += `- REVEALED SECRET: ${arc.revealText}\n`;
            }
        });
    }

    return text;
};

export const compileCharacterSystemPrompt = (char: CharacterProfile): string => {
    // 1. Base Identity
    // Use the constraints bio if available, else fall back to old system prompt
    let prompt = char.constraints ? 
        `You are ${char.name}. ${char.constraints.fullBio}\nAppearance: ${char.constraints.appearanceDescription}` : 
        char.systemPrompt;

    // 2. Constraints Block
    if (char.constraints) {
        prompt += "\n\n" + compileSystemConstraints(char.constraints, char.name);
        prompt += compileStyleVoice(char.constraints, char.progression?.bondLevel || 0);
    }

    // 3. Capabilities Block
    if (char.capabilities) {
        prompt += compileCapabilities(char.capabilities);
    }

    // 4. Spatial Block
    const mapping = char.mappingLogic || DEFAULT_MAPPING_LOGIC;
    prompt += `\n\n**SPATIAL LOGIC**\n${mapping}`;

    // 5. Lore Block
    prompt += compileLore(char);

    return prompt;
};
