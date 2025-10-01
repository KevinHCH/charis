import keytar from 'keytar';

const SERVICE = 'charis';

export async function getApiKey(name = 'GEMINI_API_KEY'): Promise<string> {
  try {
    const stored = await keytar.getPassword(SERVICE, name);
    return stored ?? process.env[name] ?? '';
  } catch {
    return process.env[name] ?? '';
  }
}

export async function setApiKey(value: string, name = 'GEMINI_API_KEY'): Promise<void> {
  await keytar.setPassword(SERVICE, name, value);
}
