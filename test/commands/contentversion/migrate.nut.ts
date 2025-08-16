import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';

describe('contentversion migrate NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({ devhubAuthStrategy: 'NONE' });
  });

  after(async () => {
    await session?.clean();
  });

  it('shows help for the migrate command', () => {
    const output = execCmd('contentversion migrate --help', { ensureExitCode: 0 }).shellOutput.stdout;
    expect(output).to.include('Migrate Salesforce Files');
    expect(output).to.include('--source-org');
    expect(output).to.include('--target-org');
  });

  it('errors when no target org is specified', () => {
    const result = execCmd('contentversion migrate', { ensureExitCode: 1 });
    expect(result.shellOutput.stderr).to.include('No default environment found');
    expect(result.shellOutput.stderr).to.include('--target-org');
  });

  it('errors when the target org is unknown', () => {
    const result = execCmd('contentversion migrate --target-org foo', { ensureExitCode: 1 });
    expect(result.shellOutput.stderr).to.include('No authorization information found for foo');
  });

  it('returns JSON output on error when --json is used', () => {
    const result = execCmd('contentversion migrate --json', { ensureExitCode: 1 });
    expect(result.jsonOutput?.message).to.include('No default environment found');
  });
});
