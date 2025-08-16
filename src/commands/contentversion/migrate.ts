import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Org, Connection } from '@salesforce/core';
import * as prompts from '@inquirer/prompts';
import chalk from 'chalk';
import { Field } from 'jsforce';

import { getSObjectList, getSoqlWhereFilter, selectSObject, selectSObjectField } from '../../shared/orgUtils.js';
import { getCount, getMappedTargetRecords, getRecords } from '../../shared/dataUtils.js';
import { ContentVersionMigrateResult } from '../../shared/commonTypes.js';
import { generateLog } from '../../shared/commonUtils.js';
import { processRecords } from '../../shared/processingUtils.js';
import { API_VERSION } from '../../shared/constants.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@adampetrovich/cvmove', 'contentversion.migrate');

export default class ContentVersionMigrate extends SfCommand<ContentVersionMigrateResult> {
  public static enableJsonFlag = true;
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'source-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.source-org.summary'),
      description: messages.getMessage('flags.source-org.description'),
      char: 's',
      required: true,
    }),
    'target-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      description: messages.getMessage('flags.target-org.description'),
      char: 't',
      required: true,
    }),
    'source-object': Flags.string({
      summary: messages.getMessage('flags.source-object.summary'),
      description: messages.getMessage('flags.source-object.description'),
      aliases: ['sobj'],
      required: false,
    }),
    'target-object': Flags.string({
      summary: messages.getMessage('flags.target-object.summary'),
      description: messages.getMessage('flags.target-object.description'),
      aliases: ['tobj'],
      required: false,
    }),
    'source-id-field': Flags.string({
      summary: messages.getMessage('flags.source-id-field.summary'),
      description: messages.getMessage('flags.source-id-field.description'),
      aliases: ['sid'],
      required: false,
    }),
    'target-id-field': Flags.string({
      summary: messages.getMessage('flags.target-id-field.summary'),
      description: messages.getMessage('flags.target-id-field.description'),
      aliases: ['tid'],
      required: false,
    }),
    'source-where-filter': Flags.string({
      summary: messages.getMessage('flags.source-where-filter.summary'),
      description: messages.getMessage('flags.source-where-filter.description'),
      aliases: ['sw'],
      required: false,
    }),
    'downloads-path': Flags.string({
      summary: messages.getMessage('flags.downloads-path.summary'),
      description: messages.getMessage('flags.downloads-path.description'),
      aliases: ['dp'],
      required: true,
      default: process.cwd(),
    }),
    'no-save-locally': Flags.boolean({
      summary: messages.getMessage('flags.no-save-locally.summary'),
      description: messages.getMessage('flags.no-save-locally.description'),
      aliases: ['nsl'],
      required: false,
    }),
    'no-prompts': Flags.boolean({
      summary: messages.getMessage('flags.no-prompts.summary'),
      description: messages.getMessage('flags.no-prompts.description'),
      char: 'n',
      required: false,
    }),
  };

  private static async resolveSObject(
    connection: Connection,
    flagValue: string | undefined,
    label: 'source' | 'target'
  ): Promise<string> {
    return flagValue ?? selectSObject(label, await getSObjectList(connection));
  }

  private static async resolveField(
    label: string,
    connection: Connection,
    sObject: string,
    flagValue: string | undefined,
    filterFn: (value: Field, index: number, array: Field[]) => boolean
  ): Promise<string> {
    return flagValue ?? selectSObjectField(label, connection, sObject, filterFn);
  }

  private static async resolveWhereFilter(flagValue: string | undefined): Promise<string> {
    return flagValue ?? getSoqlWhereFilter('WHERE filter for source object', 'Id != NULL');
  }

  private static async confirmStart(noPrompts: boolean): Promise<boolean> {
    return noPrompts || (await prompts.confirm({ message: 'Ready to start migration?' }));
  }

  public async run(): Promise<ContentVersionMigrateResult> {
    const { flags } = await this.parse(ContentVersionMigrate);

    const srcOrg: Org = flags['source-org'];
    const tgtOrg: Org = flags['target-org'];
    const sourceConn = srcOrg.getConnection(API_VERSION);
    const targetConn = tgtOrg.getConnection(API_VERSION);

    const sourceObject = await ContentVersionMigrate.resolveSObject(sourceConn, flags['source-object'], 'source');
    const targetObject = await ContentVersionMigrate.resolveSObject(targetConn, flags['target-object'], 'target');

    const sourceField = await ContentVersionMigrate.resolveField(
      'source ID field',
      sourceConn,
      sourceObject,
      flags['source-id-field'],
      (f) =>
        ['id', 'reference', 'string', 'number'].includes(f.type) &&
        ((f.externalId && f.unique) || f.type === 'id' || f.type === 'reference')
    );

    const targetField = await ContentVersionMigrate.resolveField(
      'target ID field',
      targetConn,
      targetObject,
      flags['target-id-field'],
      (f) => ['id', 'string', 'number'].includes(f.type) && ((f.externalId && f.unique) || f.type === 'id')
    );

    const whereFilter = await ContentVersionMigrate.resolveWhereFilter(flags['source-where-filter']);

    const { 'no-prompts': noPrompts, json } = flags;

    const sourceCount = await getCount(sourceConn, sourceObject, whereFilter);

    if (!json) {
      this.log(
        `${chalk.red.bold(sourceCount)} records of type ${chalk.blueBright.bold(sourceObject)} will be processed.`
      );
    }

    const saveLocal = !flags['no-save-locally'];
    const downloadsPath = flags['downloads-path'];

    const result: ContentVersionMigrateResult = {
      sourceOrgId: srcOrg.getOrgId(),
      targetOrgId: tgtOrg.getOrgId(),
      recordMigrations: [],
      messages: [],
    };

    if (!(await ContentVersionMigrate.confirmStart(noPrompts))) {
      result.messages.push(generateLog('warning', 'Migration canceled by user.'));

      if (!json) {
        this.log(chalk.yellow('Migration canceled by user.'));
      }

      return result;
    }

    const sourceRecords = await getRecords(sourceConn, sourceObject, whereFilter, sourceField, sourceCount);
    const mappedRecords = await getMappedTargetRecords(
      sourceRecords,
      sourceField,
      targetConn,
      targetObject,
      targetField,
      result
    );

    await processRecords(sourceConn, targetConn, mappedRecords, saveLocal, downloadsPath, result);

    if (json) {
      this.log(JSON.stringify(result, null, 4));
    } else {
      this.log(chalk.green('Migration completed!'));
    }

    return result;
  }
}
