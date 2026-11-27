import { describe, expect, it } from 'vitest';
import { GAME_LOG_FILE_NAME } from '../src/log/folder-access';

describe('project setup', () => {
  it('targets the Game.log file', () => {
    expect(GAME_LOG_FILE_NAME).toBe('Game.log');
  });
});
