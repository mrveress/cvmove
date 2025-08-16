import path from 'node:path';
import fs from 'node:fs';
import { Connection } from '@salesforce/core';
import cliProgress from 'cli-progress';
import { downloadContentVersion, getContentVersionStoragePath, uploadContentVersion } from './fileUtils.js';
import {
  CommonParams,
  ContentDocumentLink,
  ContentVersionMigrateResult,
  LogContentVersionMigration,
  LogRecordMigration,
  MappedRecord,
  QueriedRecord,
} from './commonTypes.js';
import { generateLog } from './commonUtils.js';

export async function processRecords(
  sourceOrgConnection: Connection,
  targetOrgConnection: Connection,
  mappedRecords: MappedRecord[],
  isSaveFilesLocally: boolean,
  downloadsPath: string,
  result: ContentVersionMigrateResult
): Promise<void> {
  const storagePath = await getContentVersionStoragePath(sourceOrgConnection, targetOrgConnection, downloadsPath);

  const commonParams: CommonParams = {
    sourceOrgConnection,
    targetOrgConnection,
    storagePath,
    isSaveFilesLocally,
    multiBar: new cliProgress.MultiBar(
      {
        clearOnComplete: false,
        hideCursor: true,
        format: ' {bar} | {label} | {value}/{total}',
      },
      cliProgress.Presets.shades_classic
    ),
    result,
  };

  const recordBar = commonParams.multiBar.create(mappedRecords.length, 0, { label: 'Start processing records...' });
  let recordsProcessed = 0;
  for (const { sourceRecord, targetRecord } of mappedRecords) {
    recordBar.update(recordsProcessed, { label: `Processing ${sourceRecord.Id}...` });

    /* eslint-disable-next-line no-await-in-loop */
    await processRecord(sourceRecord, targetRecord, commonParams);

    recordsProcessed++;
    recordBar.update(recordsProcessed, { label: `Processed ${sourceRecord.Id}...` });
  }
  commonParams.multiBar.remove(recordBar);
  commonParams.multiBar.stop();
}

async function processRecord(
  sourceRecord: QueriedRecord,
  targetRecord: QueriedRecord,
  commonParams: CommonParams
): Promise<void> {
  const recordLog: LogRecordMigration = {
    sourceId: sourceRecord.Id,
    targetId: targetRecord.Id,
    contentVersionMigrations: [],
    messages: [],
  };

  if (!sourceRecord.ContentDocumentLinks || sourceRecord.ContentDocumentLinks.length <= 0) {
    recordLog.messages.push(generateLog('skip', 'No ContentDocumentLinks found'));
    return;
  }
  const fileBar = commonParams.multiBar.create(sourceRecord.ContentDocumentLinks.length, 0, {
    label: `Start processing files for ${sourceRecord.Id}...`,
  });

  let filesProcessed = 0;

  const sourceLinks = sourceRecord.ContentDocumentLinks?.records || [];
  for (const sourceDocumentLink of sourceLinks) {
    const sourceFileName = sourceDocumentLink.ContentDocument.LatestPublishedVersion.PathOnClient;
    fileBar.update(filesProcessed, { label: `Processing ${sourceFileName}...` });

    const targetDocumentLink = (targetRecord.ContentDocumentLinks?.records ?? []).find((documentLinkItem) =>
      checkIdentity(sourceDocumentLink, documentLinkItem)
    );

    let contentVersionMigrationLog;
    if (targetDocumentLink) {
      recordLog.messages.push(generateLog('skip', `"${sourceFileName}" already exists on target record`));
    } else {
      /* eslint-disable-next-line no-await-in-loop */
      contentVersionMigrationLog = await processFile(
        sourceRecord,
        sourceDocumentLink,
        targetRecord,
        commonParams,
        recordLog
      );
    }

    // Delete the file from local storage after processing
    if (!commonParams.isSaveFilesLocally) {
      deleteFile(sourceRecord, sourceDocumentLink, commonParams, contentVersionMigrationLog);
    }

    filesProcessed++;
    fileBar.update(filesProcessed, { label: `Processed ${sourceFileName}...` });
  }
  commonParams.multiBar.remove(fileBar);

  commonParams.result.recordMigrations.push(recordLog);
}

function deleteFile(
  sourceRecord: QueriedRecord,
  sourceDocumentLink: ContentDocumentLink,
  commonParams: CommonParams,
  contentVersionMigrationLog: LogContentVersionMigration | undefined
): void {
  const sourceContentVersionId = sourceDocumentLink.ContentDocument.LatestPublishedVersionId;
  const sourceFileName = sourceDocumentLink.ContentDocument.LatestPublishedVersion.PathOnClient;

  const sourceFilePath = path.join(
    commonParams.storagePath,
    `${sourceRecord.Id}-${sourceContentVersionId}`,
    sourceFileName
  );

  if (!fs.existsSync(sourceFilePath)) {
    fs.unlinkSync(sourceFilePath);

    if (contentVersionMigrationLog) {
      contentVersionMigrationLog.messages.push(generateLog('success', 'Deleted file from local storage'));
    }
  }
}

async function processFile(
  sourceRecord: QueriedRecord,
  sourceDocumentLink: ContentDocumentLink,
  targetRecord: QueriedRecord,
  commonParams: CommonParams,
  recordLog: LogRecordMigration
): Promise<LogContentVersionMigration> {
  const contentVersionMigrationLog: LogContentVersionMigration = {
    sourceId: sourceDocumentLink.ContentDocument.LatestPublishedVersionId,
    messages: [],
  };

  const sourceContentVersionId = sourceDocumentLink.ContentDocument.LatestPublishedVersionId;
  const sourceFileName = sourceDocumentLink.ContentDocument.LatestPublishedVersion.PathOnClient;

  const sourceFilePath = path.join(
    commonParams.storagePath,
    `${sourceRecord.Id}-${sourceContentVersionId}`,
    sourceFileName
  );

  if (!fs.existsSync(sourceFilePath)) {
    await downloadContentVersion(sourceDocumentLink, sourceFilePath, commonParams, contentVersionMigrationLog);
  }

  contentVersionMigrationLog.targetId = await uploadContentVersion(
    targetRecord,
    sourceFilePath,
    commonParams,
    contentVersionMigrationLog
  );
  recordLog.contentVersionMigrations.push(contentVersionMigrationLog);
  return contentVersionMigrationLog;
}

function checkIdentity(sourceDocumentLink: ContentDocumentLink, targetDocumentLink: ContentDocumentLink): boolean {
  const sourceVersion = sourceDocumentLink.ContentDocument?.LatestPublishedVersion;
  const targetVersion = targetDocumentLink.ContentDocument?.LatestPublishedVersion;

  if (!sourceVersion || !targetVersion) return false;

  return (
    sourceVersion.PathOnClient === targetVersion.PathOnClient && sourceVersion.ContentSize === targetVersion.ContentSize
  );
}
