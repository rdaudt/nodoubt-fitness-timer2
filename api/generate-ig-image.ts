import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PROMPT_PATH = path.join(process.cwd(), 'docs', 'nodoubt_hiit_prompt_production.md');
const LOGO_PATH = path.join(process.cwd(), 'media', 'nodoubt-fitness-logo-transparent.png');
const COACH_PATH = path.join(process.cwd(), 'media', 'coach-gabe-and-kobe-poster.png');

const MODEL = 'gpt-image-2';
const OUTPUT_SIZE = '1088x1360';
const OUTPUT_FORMAT = 'png';

interface StationSetWorkoutType {
  stationSetNumber: number;
  workoutType: string;
}

interface GenerationPayload {
  run: {
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
  };
}

type NodeReq = {
  method?: string;
  body?: unknown;
};

type NodeRes = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

const safeJson = (value: unknown): string => JSON.stringify(value, null, 2);

const validatePayload = (value: unknown): GenerationPayload | null => {
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

const parseBody = (body: unknown): unknown => {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body;
};

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    response.status(500).json({ error: 'Server misconfiguration: OPENAI_API_KEY is not set.' });
    return;
  }

  const parsedBody = parseBody(request.body);
  const payload = validatePayload(parsedBody);
  if (!payload) {
    response.status(400).json({ error: 'Invalid request payload.' });
    return;
  }

  try {
    const [promptDoc, logoBytes, coachBytes] = await Promise.all([
      readFile(PROMPT_PATH, 'utf8'),
      readFile(LOGO_PATH),
      readFile(COACH_PATH),
    ]);

    const form = new FormData();
    form.set('model', MODEL);
    form.set('size', OUTPUT_SIZE);
    form.set('output_format', OUTPUT_FORMAT);
    form.set('prompt', buildPrompt(promptDoc, payload.run));
    form.append('image[]', new Blob([logoBytes], { type: 'image/png' }), 'nodoubt-fitness-logo-transparent.png');
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
      response.status(502).json({ error: `OpenAI request failed: ${message}` });
      return;
    }

    const imageBase64 = await parseOpenAiResponseImage(openAiResponse);
    response.status(200).json({
      imageBase64,
      mimeType: 'image/png',
      model: MODEL,
      size: OUTPUT_SIZE,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    response.status(500).json({ error: message });
  }
}

export {
  buildPrompt,
  validatePayload,
};
