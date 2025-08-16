import { Connection } from '@salesforce/core';
import cliProgress from 'cli-progress';
import { chunkify, generateLog, getFieldValue, getFieldValueTyped } from './commonUtils.js';
import { ContentVersionMigrateResult, MappedRecord, QueriedRecord } from './commonTypes.js';

const CONTENT_DOCUMENT_LINKS_SELECT =
  'SELECT Id, ContentDocumentId, ContentDocument.LatestPublishedVersionId, ContentDocument.LatestPublishedVersion.ContentSize, ContentDocument.LatestPublishedVersion.PathOnClient FROM ContentDocumentLinks';
const RECORDS_CHUNK_SIZE = 200;

export async function getCount(connection: Connection, sObjectApiName: string, whereFilter: string): Promise<number> {
  return (await connection.query(`SELECT COUNT() FROM ${sObjectApiName} WHERE ${whereFilter}`)).totalSize;
}

export function getRecords(
  connection: Connection,
  sObjectApiName: string,
  whereFilter: string,
  idField: string,
  count: number
): Promise<QueriedRecord[]> {
  return new Promise<QueriedRecord[]>((resolve) => {
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    const records: QueriedRecord[] = [];

    bar.start(count, 0);
    void connection
      .query(
        `
        SELECT
            ${idField === 'Id' ? idField : `Id, ${idField}`},
            (${CONTENT_DOCUMENT_LINKS_SELECT})
        FROM ${sObjectApiName}
        WHERE ${whereFilter}
    `
      )
      .on('record', (record: QueriedRecord) => {
        records.push(record);
        bar.update(records.length);
      })
      .on('end', () => {
        bar.stop();
        resolve(records);
      })
      .run({ autoFetch: true, maxFetch: count });
  });
}

export async function getMappedTargetRecords(
  sourceRecords: QueriedRecord[],
  sourceIdField: string,
  targetOrgConnection: Connection,
  targetSObjectApiName: string,
  targetIdField: string,
  result: ContentVersionMigrateResult
): Promise<MappedRecord[]> {
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(sourceRecords.length, 0);
  const mappedRecords: MappedRecord[] = [];

  await Promise.all(
    chunkify<QueriedRecord>(sourceRecords, RECORDS_CHUNK_SIZE).map(
      (chunkSourceRecords) =>
        new Promise<void>((resolve) => {
          void targetOrgConnection
            .query<QueriedRecord>(
              `
                  SELECT
                      ${targetIdField === 'Id' ? targetIdField : `Id, ${targetIdField}`},
                      (${CONTENT_DOCUMENT_LINKS_SELECT})
                  FROM ${targetSObjectApiName}
                  WHERE ${targetIdField} IN (${chunkSourceRecords
                .map((record) => `'${getFieldValueTyped<string>(record, sourceIdField)}'`)
                .join(', ')})
              `
            )
            .on('record', (record: QueriedRecord) => {
              const sourceRecord = chunkSourceRecords.find(
                (chunkSourceRecord) =>
                  getFieldValue(chunkSourceRecord, sourceIdField) === getFieldValue(record, targetIdField)
              );
              if (sourceRecord) {
                const mappedRecord = {
                  sourceRecord,
                  targetRecord: record,
                };
                mappedRecords.push(mappedRecord);
              } else {
                result.messages.push(
                  generateLog(
                    'error',
                    `Could not find source record by ${sourceIdField} (Target is "${getFieldValueTyped<string>(
                      record,
                      targetIdField
                    )}" in ${targetSObjectApiName}.${targetIdField})`
                  )
                );
              }
              bar.update(mappedRecords.length);
            })
            .on('end', () => {
              resolve();
            })
            .run({ autoFetch: true, maxFetch: RECORDS_CHUNK_SIZE });
        })
    )
  );

  bar.stop();

  return mappedRecords;
}
