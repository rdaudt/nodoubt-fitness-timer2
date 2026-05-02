import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PROMPT_PATH = path.join(process.cwd(), 'docs', 'nodoubt_hiit_prompt_production.md');
const LOGO_PATH = path.join(process.cwd(), 'media', 'nodoubt-training-logo.png');
const COACH_PATH = path.join(process.cwd(), 'media', 'coach-gabe-and-kobe-poster.png');

const MODEL = 'gpt-image-2';
const OUTPUT_SIZE = '1088x1360';
const OUTPUT_FORMAT = 'png';

interface StationSetWorkoutType {
  stationSetNumber: number;
  workoutType: string;
}

export interface GenerationRunPayload {
  id: string;
  timerNameAtRun: string;
  ranAt: string;
  location: string;
  stationSetWorkoutTypes: StationSetWorkoutType[];
  timerSnapshot: {
    stationCount: number;
    roundsPerStation: number;
    workSeconds: number;
    restSeconds: number;
    stationTransitionSeconds: number;
  };
}

export interface GenerationPayload {
  run: GenerationRunPayload;
}

const safeJson = (value: unknown): string => JSON.stringify(value, null, 2);

export const validatePayload = (value: unknown): GenerationPayload | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const run = (value as { run?: unknown }).run;
  if (!run || typeof run !== 'object') {
    return null;
  }
  const typed = run as GenerationPayload['run'];
  if (typeof typed.id !== 'string' || typeof typed.timerNameAtRun !== 'string' || typeof typed.ranAt !== 'string') {
    return null;
  }
  if (!typed.timerSnapshot || typeof typed.timerSnapshot !== 'object') {
    return null;
  }
  if (!Array.isArray(typed.stationSetWorkoutTypes)) {
    return null;
  }
  return { run: typed };
};

const buildPrompt = (promptDoc: string, runPayload: GenerationPayload['run']): string => [
  promptDoc,
  '',
  '---',
  'SESSION_JSON_SOURCE_OF_TRUTH',
  safeJson(runPayload),
  '',
  'MANDATORY_MEDIA_NOTES',
  '- Use the provided logo image exactly as supplied.',
  '- Use the provided coach + kobe image exactly as supplied.',
].join('\n');

const parseOpenAiResponseImage = async (response: Response): Promise<string> => {
  const json = await response.json() as {
    data?: Array<{ b64_json?: string }>;
    error?: { message?: string };
  };
  const imageBase64 = json.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error(json.error?.message ?? 'OpenAI did not return an image payload.');
  }
  return imageBase64;
};

export const generateImageBase64 = async (runPayload: GenerationRunPayload): Promise<string> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Server misconfiguration: OPENAI_API_KEY is not set.');
  }

  const [promptDoc, logoBytes, coachBytes] = await Promise.all([
    readFile(PROMPT_PATH, 'utf8'),
    readFile(LOGO_PATH),
    readFile(COACH_PATH),
  ]);

  const form = new FormData();
  form.set('model', MODEL);
  form.set('size', OUTPUT_SIZE);
  form.set('output_format', OUTPUT_FORMAT);
  form.set('prompt', buildPrompt(promptDoc, runPayload));
  form.append('image[]', new Blob([logoBytes], { type: 'image/png' }), 'nodoubt-training-logo.png');
  form.append('image[]', new Blob([coachBytes], { type: 'image/png' }), 'coach-gabe-and-kobe-poster.png');

  const openAiResponse = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!openAiResponse.ok) {
    const message = await openAiResponse.text();
    throw new Error(`OpenAI request failed: ${message}`);
  }

  return parseOpenAiResponseImage(openAiResponse);
};

export {
  buildPrompt,
  MODEL,
  OUTPUT_SIZE,
};
