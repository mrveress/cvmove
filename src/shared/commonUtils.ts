import { LogMessage, MessageSeverity, QueriedRecord } from './commonTypes.js';

export function chunkify<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export function getFieldValue(record: QueriedRecord, field: string): unknown {
  return (record as Record<string, unknown>)[field];
}

export function getFieldValueTyped<T>(record: QueriedRecord, field: string): T {
  return getFieldValue(record, field) as T;
}

export function generateLog(severity: MessageSeverity, message: string): LogMessage {
  return {
    timestamp: new Date(),
    severity,
    message,
  };
}

export function typedJsonParse<T>(str: string): T | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(str);
    return parsed as unknown as T;
  } catch {
    return undefined;
  }
}
