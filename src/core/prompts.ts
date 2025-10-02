import { GoogleGenAI } from '@google/genai';
import { extractText } from '../providers/geminiUtils';

const SYSTEM_PROMPT = `Task: Rewrite a prompt for image generation.
Guidelines:
- Preserve the original intent.
- Add concrete details about style, lighting, composition, camera, and quality.
- Avoid vague language. Return a single final prompt.`;

export async function improvePrompt(apiKey: string, model: string, userPrompt: string, style?: string): Promise<string> {
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: SYSTEM_PROMPT },
          { text: `User prompt: ${userPrompt}` },
          { text: `Additional style: ${style ?? ''}` },
        ],
      },
    ],
  });
  const text = extractText(response);
  return text.length ? text : userPrompt;
}
