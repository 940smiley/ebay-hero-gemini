import { describe, it, expect, beforeEach } from 'vitest';
import { logger } from '../src/services/logger.ts';
import { serverLogger } from '../server/logger.ts';

describe('Structured Diagnostic Logging System', () => {
  beforeEach(() => {
    logger.clear();
    serverLogger.clear();
  });

  it('records structured entries with timestamp, level, subsystem, and event', () => {
    logger.info('Google Photos', 'session_created', 'Session initialized', {
      operationId: 'test-session-123',
      details: { pollIntervalMs: 3000 },
    });

    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('INFO');
    expect(entries[0].subsystem).toBe('Google Photos');
    expect(entries[0].event).toBe('session_created');
    expect(entries[0].operationId).toBe('test-session-123');
    expect(entries[0].details).toEqual({ pollIntervalMs: 3000 });
  });

  it('strictly redacts Bearer tokens, API keys, client secrets, and passwords in frontend logger', () => {
    logger.warn('OAuth Auth', 'token_acquired', 'Acquired tokens', {
      details: {
        authorization: 'Bearer ya29.a0AfH6SMB_secret_access_token_12345',
        client_secret: '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',
        apiKey: 'AIzaSyCH-JBKgLSnwC2ftD5DHPQCmprYKNJU_Ls',
        nested: {
          refreshToken: '1//04_refresh_token_xyz',
          password: 'mySecretPassword!',
        },
      },
    });

    const entry = logger.getEntries()[0];
    expect(entry.details?.authorization).toBe('[REDACTED]');
    expect(entry.details?.client_secret).toBe('[REDACTED]');
    expect(entry.details?.apiKey).toBe('[REDACTED]');
    expect(entry.details?.nested?.refreshToken).toBe('[REDACTED]');
    expect(entry.details?.nested?.password).toBe('[REDACTED]');
  });

  it('redacts tokens and keys embedded in text messages', () => {
    logger.error('Gemini Vision', 'api_call', 'Failed calling with Bearer ya29.secretToken and AIzaSyCH-JBKgLSnwC2ftD5DHPQCmprYKNJU_Ls');
    const entry = logger.getEntries()[0];
    expect(entry.message).not.toContain('ya29.secretToken');
    expect(entry.message).not.toContain('AIzaSyCH');
  });

  it('server logger also redacts sensitive credentials and supports levels', () => {
    serverLogger.error('OAuth Auth', 'token_refresh_failed', 'Failed with client_secret="secret123"', {
      details: {
        accessToken: 'secret_token_abc',
        safeParam: 'public_value',
      },
    });

    const entries = serverLogger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('ERROR');
    expect(entries[0].details?.accessToken).toBe('[REDACTED]');
    expect(entries[0].details?.safeParam).toBe('public_value');
  });

  it('notifies subscribers in real-time when new entries arrive', () => {
    let callCount = 0;
    const unsub = logger.subscribe((entries) => {
      callCount++;
    });

    logger.debug('System', 'test_event', 'First test message');
    logger.info('System', 'test_event_2', 'Second test message');

    unsub();
    logger.warn('System', 'test_event_3', 'Third message after unsub');

    expect(callCount).toBe(3); // Initial subscription tick + 2 logs
  });

  it('exports logs to JSON and plaintext formats correctly', () => {
    logger.info('Managed Library', 'file_stored', 'Stored image file 1');
    logger.info('Managed Library', 'file_stored', 'Stored image file 2');

    const jsonText = logger.exportToJson();
    const parsed = JSON.parse(jsonText);
    expect(parsed).toHaveLength(2);

    const plainText = logger.exportToPlainText();
    expect(plainText).toContain('[INFO ] [Managed Library] file_stored: Stored image file 1');
    expect(plainText).toContain('[INFO ] [Managed Library] file_stored: Stored image file 2');
  });
});
