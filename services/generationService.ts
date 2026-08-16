/**
 * generationService.ts
 * Pass 2 – Domain Extraction
 *
 * Owns prompt assembly and modality-specific overrides so App.tsx
 * no longer contains the bulk of generation orchestration logic.
 */

import {
  Message,
  Room,
  CharacterProfile,
  AppSettings,
  MoodState,
  ScriptoriumConfig,
  DungeonConfig,
  Outfit,
  ScriptoriumTools
} from '../types';
import {
  DEFAULT_ROOMS,
  YSARAITH_PLAYER_PROMPT_ADDENDUM
} from '../constants';
import { compileCharacterSystemPrompt } from './promptCompiler';
import { streamGeminiResponse } from './geminiService';
import { streamGrokResponse } from './grokService';

export type GenerationMode = 'ritual' | 'scriptorium' | 'dungeon-dm' | 'dungeon-player' | 'ooc' | 'advisory';

export interface GenerationContext {
  messages: Message[];
  character: CharacterProfile;
  settings: AppSettings;
  moodState: MoodState;
  room?: Room;
  outfit?: Outfit | null;
  scriptoriumConfig?: ScriptoriumConfig;
  dungeonConfig?: DungeonConfig;
  mode: GenerationMode;
  injectionPrompt?: string;
  overrideSettings?: Partial<AppSettings>;
}

export interface GenerationResult {
  fullText: string;
  aborted: boolean;
  error?: string;
}

/**
 * Build the effective system prompt for the given mode.
 */
export function buildSystemPrompt(ctx: GenerationContext): string {
  const { character, mode, scriptoriumConfig, dungeonConfig, outfit, settings, injectionPrompt } = ctx;
  let prompt = '';

  switch (mode) {
    case 'scriptorium':
      prompt = scriptoriumConfig?.systemPrompt || 'You are a helpful secretary.';
      break;

    case 'dungeon-dm':
      prompt = dungeonConfig?.dmSystemPrompt || 'You are a DM.';
      break;

    case 'dungeon-player': {
      const base = compileCharacterSystemPrompt(character);
      const demeanor =
        dungeonConfig?.ysaraithDemeanorInfo ||
        dungeonConfig?.ysaraithDemeanorLabel ||
        'Neutral';
      prompt = `${base}\n${YSARAITH_PLAYER_PROMPT_ADDENDUM}\n[CURRENT DEMEANOR: ${demeanor}]\n`;
      break;
    }

    case 'ritual':
    default: {
      prompt = compileCharacterSystemPrompt(character);
      if (outfit) {
        prompt += `\n\n[CURRENT OUTFIT: ${outfit.name} - ${outfit.description}]`;
      }
      break;
    }
  }

  // Style modifiers (shared)
  const intensity = settings.roleplayIntensity;
  if (typeof intensity === 'number' || settings.writingStyle || settings.formattingStyle) {
    prompt += `\n\n**STYLE MODIFIERS:**\n`;
    if (typeof intensity === 'number') {
      if (intensity < 50) {
        prompt += `- Adherence: Relaxed. Breaks in character are permissible for clarity.\n`;
      } else {
        prompt += `- Adherence: Strict (${intensity}%). Total immersion.\n`;
      }
    }
  }

  if (injectionPrompt) {
    prompt += `\n\n${injectionPrompt}\n`;
  }

  return prompt;
}

/**
 * Resolve the Room object used for the generation call.
 */
export function resolveRoom(ctx: GenerationContext): Room {
  if (ctx.mode === 'scriptorium') {
    return {
      ...DEFAULT_ROOMS[0],
      name: 'Scriptorium',
      description: 'The Administrative Domain.',
      systemPromptOverride: ctx.scriptoriumConfig?.systemPrompt
    };
  }
  if (ctx.mode === 'dungeon-dm' || ctx.mode === 'dungeon-player') {
    return {
      ...DEFAULT_ROOMS[0],
      name: 'The Gauntlet',
      description: 'A table set in shadows.',
      systemPromptOverride: ctx.dungeonConfig?.dmSystemPrompt
    };
  }
  return ctx.room || DEFAULT_ROOMS[0];
}

/**
 * Standardised user-facing error string.
 */
export function formatGenerationError(error: unknown): string {
  if (!error) return '[System Error: Unknown Connection Failure]';

  const raw = (error as any)?.message || String(error);

  // Try to extract nested JSON message if present
  try {
    const jsonMatch = raw.match(/"message"\s*:\s*"([^"]+)"/);
    if (jsonMatch?.[1]) {
      return `[System Error: ${jsonMatch[1]}]`;
    }
  } catch {
    // ignore
  }

  if (raw.includes('Aborted') || (error as any)?.name === 'AbortError') {
    return '[Ritual Interrupted]';
  }

  return `[System Error: ${raw}]`;
}

/**
 * Unified streaming entry point.
 * Returns the full accumulated text (or error marker).
 */
export async function runGeneration(
  ctx: GenerationContext,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<GenerationResult> {
  const effectiveSettings: AppSettings = {
    ...ctx.settings,
    ...(ctx.overrideSettings || {})
  };

  const systemPrompt = buildSystemPrompt(ctx);
  const augmentedCharacter: CharacterProfile = {
    ...ctx.character,
    systemPrompt
  };
  const room = resolveRoom(ctx);

  let fullText = '';
  let aborted = false;

  try {
    if (effectiveSettings.activeProvider === 'gemini') {
      const tools: ScriptoriumTools | undefined =
        ctx.mode === 'scriptorium' ? ctx.scriptoriumConfig?.tools : undefined;

      fullText = await streamGeminiResponse(
        ctx.messages,
        room,
        effectiveSettings,
        augmentedCharacter,
        ctx.moodState,
        (chunk) => {
          fullText += chunk; // streamGemini already accumulates in some paths; keep local too
          onChunk(chunk);
        },
        signal,
        tools
      );
    } else {
      fullText = await streamGrokResponse(
        ctx.messages,
        room,
        effectiveSettings,
        augmentedCharacter,
        (chunk) => {
          fullText += chunk;
          onChunk(chunk);
        },
        signal
      );
    }

    // Some providers return the full text; ensure we have something
    if (!fullText) {
      fullText = ' [Silence. The connection flickers.]';
    }

    return { fullText, aborted: false };
  } catch (err) {
    if (signal?.aborted || (err as any)?.name === 'AbortError') {
      aborted = true;
      return { fullText: fullText || '[Ritual Interrupted]', aborted: true };
    }
    const errorMsg = formatGenerationError(err);
    return { fullText: errorMsg, aborted: false, error: errorMsg };
  }
}
