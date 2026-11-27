import { readFileSync } from 'node:fs';

const COMMIT_PATTERN =
  /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9-]+\))?!?: \S.{0,99}$/;

const messagePath = process.argv[2];
const firstLine = readFileSync(messagePath, 'utf8').split('\n')[0] ?? '';

if (firstLine.startsWith('Merge ') || firstLine.startsWith('Revert ')) {
  process.exit(0);
}

if (!COMMIT_PATTERN.test(firstLine)) {
  console.error(`Commit message does not follow Conventional Commits:\n  ${firstLine}`);
  console.error('Expected: type(scope): description, e.g. feat(routing): add capacity check');
  process.exit(1);
}
