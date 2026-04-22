import { ConsumeMessage } from 'amqplib';

export function parsePayload<T>(message: ConsumeMessage): T {
  return JSON.parse(message.content.toString('utf-8')) as T;
}

export function normalizeSubject(subject?: string | null): string {
  if (!subject) return '';

  return subject
    .toLowerCase()
    .replace(/^(re|fw|fwd)\s*:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractGarantiaCode(subject?: string | null, bodyText?: string | null): string | null {
  const niRegex = /(?:controle\s*interno|codigo\s*de\s*controle\s*interno|ni|nota\s*interna)\s*(?:n|no|num|numero|nro|nr|#|:|-|nº|n°)?\s*([0-9]{6})\b/i;

  const fromSubject = subject ? niRegex.exec(subject) : null;
  if (fromSubject?.[1]) return fromSubject[1];

  const fromBody = bodyText ? niRegex.exec(bodyText) : null;
  if (fromBody?.[1]) return fromBody[1];

  return null;
}