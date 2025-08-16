import { TestContext } from '@salesforce/core/testSetup';
import { Org } from '@salesforce/core';
import { expect } from 'chai';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import sinon from 'sinon';
import esmock from 'esmock';
import type { Interfaces } from '@oclif/core';

describe('contentversion migrate', () => {
  const $$ = new TestContext();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
    sinon.restore();
  });

  const createOrgStub = (id: string): Org =>
    ({
      getConnection: sinon.stub().returns({}),
      getOrgId: sinon.stub().returns(id),
    } as unknown as Org);

  it('runs migration without prompts', async () => {
    const srcOrg = createOrgStub('00Dsrc');
    const tgtOrg = createOrgStub('00Dtgt');

    const getCountStub = sinon.stub().resolves(1);
    const sourceRecord = { Id: '1', ContentDocumentLinks: { records: [], length: 0 } };
    const getRecordsStub = sinon.stub().resolves([sourceRecord]);
    const getMappedStub = sinon.stub().resolves([{ sourceRecord, targetRecord: sourceRecord }]);
    const processStub = sinon.stub().resolves();

    const { default: ContentVersionMigrate } = await esmock<
      typeof import('../../../src/commands/contentversion/migrate.js')
    >('../../../src/commands/contentversion/migrate.js', {
      '../../../src/shared/dataUtils.js': {
        getCount: getCountStub,
        getRecords: getRecordsStub,
        getMappedTargetRecords: getMappedStub,
      },
      '../../../src/shared/processingUtils.js': {
        processRecords: processStub,
      },
      '@inquirer/prompts': { confirm: sinon.stub() },
    });

    type FlagsType = Interfaces.InferredFlags<(typeof ContentVersionMigrate)['flags']>;
    const flags: FlagsType = {
      'source-org': srcOrg,
      'target-org': tgtOrg,
      'source-object': 'Account',
      'target-object': 'Account',
      'source-id-field': 'Id',
      'target-id-field': 'Id',
      'source-where-filter': 'Id != NULL',
      'no-save-locally': false,
      'downloads-path': process.cwd(),
      'no-prompts': true,
      json: false,
    };
    type Parse = () => Promise<{ flags: FlagsType }>;
    sinon.stub(ContentVersionMigrate.prototype as unknown as { parse: Parse }, 'parse').resolves({ flags });

    const result = await ContentVersionMigrate.run([]);

    expect(getCountStub.calledOnce).to.be.true;
    expect(getRecordsStub.calledOnce).to.be.true;
    expect(getMappedStub.calledOnce).to.be.true;
    expect(processStub.calledOnce).to.be.true;
    expect(result.sourceOrgId).to.equal('00Dsrc');
    expect(result.targetOrgId).to.equal('00Dtgt');
    const output = sfCommandStubs.log
      .getCalls()
      .flatMap((c) => c.args)
      .join('\n');
    expect(output).to.include('records of type');
    expect(output).to.include('Migration completed!');
  });

  it('cancels migration when user declines confirmation', async () => {
    const srcOrg = createOrgStub('00Dsrc');
    const tgtOrg = createOrgStub('00Dtgt');

    const getCountStub = sinon.stub().resolves(1);
    const getRecordsStub = sinon.stub().resolves([]);
    const getMappedStub = sinon.stub().resolves([]);
    const processStub = sinon.stub().resolves();
    const confirmStub = sinon.stub();
    confirmStub.onFirstCall().resolves(false);

    const { default: ContentVersionMigrate } = await esmock<
      typeof import('../../../src/commands/contentversion/migrate.js')
    >('../../../src/commands/contentversion/migrate.js', {
      '../../../src/shared/dataUtils.js': {
        getCount: getCountStub,
        getRecords: getRecordsStub,
        getMappedTargetRecords: getMappedStub,
      },
      '../../../src/shared/processingUtils.js': {
        processRecords: processStub,
      },
      '@inquirer/prompts': { confirm: confirmStub },
    });

    type FlagsType = Interfaces.InferredFlags<(typeof ContentVersionMigrate)['flags']>;
    const flags: FlagsType = {
      'source-org': srcOrg,
      'target-org': tgtOrg,
      'source-object': 'Account',
      'target-object': 'Account',
      'source-id-field': 'Id',
      'target-id-field': 'Id',
      'source-where-filter': 'Id != NULL',
      'no-save-locally': false,
      'downloads-path': process.cwd(),
      'no-prompts': false,
      json: false,
    };
    type Parse = () => Promise<{ flags: FlagsType }>;
    sinon.stub(ContentVersionMigrate.prototype as unknown as { parse: Parse }, 'parse').resolves({ flags });

    const result = await ContentVersionMigrate.run([]);

    expect(confirmStub.calledOnce).to.be.true;
    expect(getRecordsStub.called).to.be.false;
    expect(getMappedStub.called).to.be.false;
    expect(processStub.called).to.be.false;
    expect(result.messages).to.have.length(1);
    const output = sfCommandStubs.log
      .getCalls()
      .flatMap((c) => c.args)
      .join('\n');
    expect(output).to.include('Migration canceled by user.');
  });

  it('honors the no-save-locally flag', async () => {
    const srcOrg = createOrgStub('00Dsrc');
    const tgtOrg = createOrgStub('00Dtgt');

    const getCountStub = sinon.stub().resolves(1);
    const sourceRecord = { Id: '1', ContentDocumentLinks: { records: [], length: 0 } };
    const getRecordsStub = sinon.stub().resolves([sourceRecord]);
    const getMappedStub = sinon.stub().resolves([{ sourceRecord, targetRecord: sourceRecord }]);
    const processStub = sinon.stub().resolves();

    const { default: ContentVersionMigrate } = await esmock<
      typeof import('../../../src/commands/contentversion/migrate.js')
    >('../../../src/commands/contentversion/migrate.js', {
      '../../../src/shared/dataUtils.js': {
        getCount: getCountStub,
        getRecords: getRecordsStub,
        getMappedTargetRecords: getMappedStub,
      },
      '../../../src/shared/processingUtils.js': {
        processRecords: processStub,
      },
      '@inquirer/prompts': { confirm: sinon.stub() },
    });

    type FlagsType = Interfaces.InferredFlags<(typeof ContentVersionMigrate)['flags']>;
    const flags: FlagsType = {
      'source-org': srcOrg,
      'target-org': tgtOrg,
      'source-object': 'Account',
      'target-object': 'Account',
      'source-id-field': 'Id',
      'target-id-field': 'Id',
      'source-where-filter': 'Id != NULL',
      'no-save-locally': true,
      'downloads-path': process.cwd(),
      'no-prompts': true,
      json: false,
    };
    type Parse = () => Promise<{ flags: FlagsType }>;
    sinon.stub(ContentVersionMigrate.prototype as unknown as { parse: Parse }, 'parse').resolves({ flags });

    await ContentVersionMigrate.run([]);

    expect(processStub.calledOnce).to.be.true;
    const args = processStub.firstCall.args as [unknown, unknown, unknown, boolean];
    const saveLocal = args[3];
    expect(saveLocal).to.be.false;
  });

  it('outputs JSON when json flag is provided', async () => {
    const srcOrg = createOrgStub('00Dsrc');
    const tgtOrg = createOrgStub('00Dtgt');

    const getCountStub = sinon.stub().resolves(0);
    const getRecordsStub = sinon.stub().resolves([]);
    const getMappedStub = sinon.stub().resolves([]);
    const processStub = sinon.stub().resolves();

    const { default: ContentVersionMigrate } = await esmock<
      typeof import('../../../src/commands/contentversion/migrate.js')
    >('../../../src/commands/contentversion/migrate.js', {
      '../../../src/shared/dataUtils.js': {
        getCount: getCountStub,
        getRecords: getRecordsStub,
        getMappedTargetRecords: getMappedStub,
      },
      '../../../src/shared/processingUtils.js': {
        processRecords: processStub,
      },
      '@inquirer/prompts': { confirm: sinon.stub() },
    });

    type FlagsType = Interfaces.InferredFlags<(typeof ContentVersionMigrate)['flags']>;
    const flags: FlagsType = {
      'source-org': srcOrg,
      'target-org': tgtOrg,
      'source-object': 'Account',
      'target-object': 'Account',
      'source-id-field': 'Id',
      'target-id-field': 'Id',
      'source-where-filter': 'Id != NULL',
      'no-save-locally': false,
      'downloads-path': process.cwd(),
      'no-prompts': true,
      json: true,
    };
    type Parse = () => Promise<{ flags: FlagsType }>;
    sinon.stub(ContentVersionMigrate.prototype as unknown as { parse: Parse }, 'parse').resolves({ flags });

    await ContentVersionMigrate.run([]);

    expect(processStub.calledOnce).to.be.true;
    const output = sfCommandStubs.log
      .getCalls()
      .flatMap((c) => c.args)
      .join('\n');
    expect(() => JSON.parse(output) as unknown).to.not.throw();
    expect(output).to.not.include('Migration completed!');
  });
});
