import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `Task: Rewrite a prompt for image generation.
Guidelines:
- Preserve the original intent.
- Add concrete details about style, lighting, composition, camera, and quality.
- Avoid vague language. Return a single final prompt.`;

export async function improvePrompt(apiKey: string, model: string, userPrompt: string, style?: string): Promise<string> {
  const client = new GoogleGenerativeAI(apiKey);
  const generativeModel = client.getGenerativeModel({ model });
  const res = await generativeModel.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { text: SYSTEM_PROMPT },
          { text: `User prompt: ${userPrompt}` },
          { text: `Additional style: ${style ?? ''}` },
        ]
      }
    ]
  });
  const text = res?.response?.candidates?.flatMap(candidate => candidate.content?.parts ?? [])
    .map(part => (part as any).text || '')
    .join(' ')
    .trim();
  return text?.length ? text : userPrompt;
}
