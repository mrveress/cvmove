import { Record as JsforceRecord } from 'jsforce';
import { Connection } from '@salesforce/core';
import { MultiBar } from 'cli-progress';

export type LogMessage = {
  severity: MessageSeverity;
  timestamp: Date;
  message: string;
};

export type LogRecordMigration = {
  sourceId: string;
  targetId: string;

  contentVersionMigrations: LogContentVersionMigration[];

  messages: LogMessage[];
};

export type LogContentVersionMigration = {
  sourceId: string;
  targetId?: string;

  messages: LogMessage[];
};

export type ContentVersionMigrateResult = {
  sourceOrgId: string;
  targetOrgId: string;

  recordMigrations: LogRecordMigration[];

  messages: LogMessage[];
};

type ParentRecord = {
  Id: string;
  ContentDocumentLinks?: {
    records: ContentDocumentLink[];
    length: number;
  };
};

export type QueriedRecord = JsforceRecord<ParentRecord>;

type ContentVersion = {
  ContentSize: number;
  PathOnClient: string;
};

type ContentDocument = {
  LatestPublishedVersionId: string;
  LatestPublishedVersion: ContentVersion;
};

export type ContentDocumentLink = {
  Id: string;
  ContentDocumentId: string;
  ContentDocument: ContentDocument;
};

export type MappedRecord = {
  sourceRecord: QueriedRecord;
  targetRecord: QueriedRecord;
};

export type CommonParams = {
  sourceOrgConnection: Connection;
  targetOrgConnection: Connection;
  storagePath: string;
  isSaveFilesLocally: boolean;
  multiBar: MultiBar;
  result: ContentVersionMigrateResult;
};

export type MessageSeverity = 'success' | 'warning' | 'error' | 'skip';

export type UploadResult = {
  id: string;
};
