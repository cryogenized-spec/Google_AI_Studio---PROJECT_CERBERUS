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
  /** Optional prefix already shown (e.g. continue-generation). */
  startText?: string;
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
 * Resolve GenerationMode from thread type + optional dungeon role.
 */
export function resolveGenerationMode(
  threadType: string | undefined,
  dungeonMode?: 'dm' | 'player'
): GenerationMode {
  if (threadType === 'scriptorium') return 'scriptorium';
  if (threadType === 'dungeon') {
    return dungeonMode === 'dm' ? 'dungeon-dm' : 'dungeon-player';
  }
  return 'ritual';
}

/**
 * Unified streaming entry point.
 * Providers already return full accumulated text; onChunk receives deltas only.
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
  const prefix = ctx.startText || '';

  try {
    let streamed = '';

    if (effectiveSettings.activeProvider === 'gemini') {
      const tools: ScriptoriumTools | undefined =
        ctx.mode === 'scriptorium' ? ctx.scriptoriumConfig?.tools : undefined;

      streamed = await streamGeminiResponse(
        ctx.messages,
        room,
        effectiveSettings,
        augmentedCharacter,
        ctx.moodState,
        onChunk,
        signal,
        tools
      );
    } else {
      streamed = await streamGrokResponse(
        ctx.messages,
        room,
        effectiveSettings,
        augmentedCharacter,
        onChunk,
        signal
      );
    }

    const fullText = prefix + (streamed || ' [Silence. The connection flickers.]');
    return { fullText, aborted: false };
  } catch (err) {
    if (signal?.aborted || (err as any)?.name === 'AbortError') {
      return { fullText: prefix || '[Ritual Interrupted]', aborted: true };
    }
    const errorMsg = formatGenerationError(err);
    return { fullText: errorMsg, aborted: false, error: errorMsg };
  }
}
