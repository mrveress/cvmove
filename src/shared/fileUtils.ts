import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import { Connection } from '@salesforce/core';
import {
  CommonParams,
  ContentDocumentLink,
  LogContentVersionMigration,
  QueriedRecord,
  UploadResult,
} from './commonTypes.js';
import { API_VERSION } from './constants.js';
import { generateLog, typedJsonParse } from './commonUtils.js';

export async function getContentVersionStoragePath(
  sourceOrgConnection: Connection,
  targetOrgConnection: Connection,
  downloadsPath: string
): Promise<string> {
  const sourceIdentity = await sourceOrgConnection.identity();
  const targetIdentity = await targetOrgConnection.identity();

  return path.join(
    downloadsPath,
    'attachments',
    `${sourceIdentity.organization_id}->${targetIdentity.organization_id}`
  );
}

export async function downloadContentVersion(
  sourceDocumentLink: ContentDocumentLink,
  sourceFilePath: string,
  commonParams: CommonParams,
  contentVersionMigrationLog: LogContentVersionMigration
): Promise<void> {
  const sourceFileName = sourceDocumentLink.ContentDocument.LatestPublishedVersion.PathOnClient;
  const sourceFileSize = sourceDocumentLink.ContentDocument.LatestPublishedVersion.ContentSize; // In bytes

  let downloadedBytes = 0;

  const downloadBar = commonParams.multiBar.create(sourceFileSize, downloadedBytes, {
    label: `Downloading ${sourceFileName}...`,
  });

  fs.mkdirSync(path.dirname(sourceFilePath), { recursive: true });
  const fileOut = fs.createWriteStream(sourceFilePath);
  commonParams.sourceOrgConnection
    .sobject('ContentVersion')
    .record(sourceDocumentLink.ContentDocument.LatestPublishedVersionId)
    .blob('VersionData')
    .on('error', (err) => {
      contentVersionMigrationLog.messages.push(
        generateLog('error', `Failed to download ${sourceFileName} - ${err.message}`)
      );
    })
    .pipe(fileOut);

  fileOut.on('data', (chunk: Buffer) => {
    downloadedBytes += chunk.length;
    downloadBar.update(downloadedBytes);
  });

  await new Promise((resolve) =>
    fileOut.on('finish', () => {
      resolve(null);
    })
  );
  downloadBar.update(sourceFileSize, { label: `Downloaded ${sourceFileName}...` });
  commonParams.multiBar.remove(downloadBar);
}

export async function uploadContentVersion(
  targetRecord: QueriedRecord,
  sourceFilePath: string,
  commonParams: CommonParams,
  contentVersionMigrationLog: LogContentVersionMigration
): Promise<string | undefined> {
  const fileName = path.basename(sourceFilePath);
  const { size: fileSize } = fs.statSync(sourceFilePath);

  let uploadedBytes = 0;
  const uploadBar = commonParams.multiBar.create(fileSize, 0, { label: `Uploading ${fileName}...` });

  // Prepare Salesforce ContentVersion metadata for the upload
  const contentVersionMetadata = {
    Title: fileName,
    PathOnClient: fileName,
    FirstPublishLocationId: targetRecord.Id,
  };

  // Use the target org connection's API version if available
  const apiVersion = commonParams.targetOrgConnection.version || API_VERSION;
  const instanceUrl = new URL(commonParams.targetOrgConnection.instanceUrl);
  const boundary = '----multipart-form-boundary-' + Date.now();
  const boundaryMarker = `--${boundary}`;
  const newline = '\r\n';

  // Build the multipart/form-data request body (JSON metadata part + file header)
  const metadataPart =
    `${boundaryMarker}${newline}` +
    `Content-Disposition: form-data; name="entity_content";${newline}` +
    `Content-Type: application/json; charset=UTF-8${newline}${newline}` +
    `${JSON.stringify(contentVersionMetadata)}${newline}`;
  const fileHeaderPart =
    `${boundaryMarker}${newline}` +
    `Content-Disposition: form-data; name="VersionData"; filename="${fileName}"${newline}` +
    `Content-Type: application/octet-stream${newline}${newline}`;
  const closingBoundary = `${newline}${boundaryMarker}--${newline}`;
  const totalBytes =
    Buffer.byteLength(metadataPart) + Buffer.byteLength(fileHeaderPart) + fileSize + Buffer.byteLength(closingBoundary);

  const options = {
    protocol: instanceUrl.protocol,
    hostname: instanceUrl.hostname,
    path: `/services/data/v${apiVersion}/sobjects/ContentVersion`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${commonParams.targetOrgConnection.accessToken ?? 'NO_TOKEN_PROVIDED'}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': totalBytes,
    },
  };

  // Perform the file upload via HTTPS, streaming the file in chunks
  const contentVersionId: string | void = await new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk: Buffer | Uint8Array) => {
        responseData += chunk.toString();
      });
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        if (status >= 200 && status < 300) {
          // Upload succeeded – finalize progress bar and capture ContentVersion Id
          uploadBar.update(fileSize, { label: `Uploaded ${fileName}...` });
          commonParams.multiBar.remove(uploadBar);
          let resultId;
          try {
            const result = typedJsonParse<UploadResult>(responseData);
            if (result) {
              resultId = result.id;
            }
          } catch (e: unknown) {
            const message = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
            contentVersionMigrationLog.messages.push(
              generateLog('error', `Failed to parse ContentVersion response for ${fileName}: ${message}`)
            );
          }
          if (!resultId) {
            contentVersionMigrationLog.messages.push(
              generateLog('error', `Uploaded ${fileName} (no ContentVersion Id returned)`)
            );
          }
          resolve(resultId);
        } else {
          // Upload failed – log error with status code and response
          commonParams.multiBar.remove(uploadBar);
          contentVersionMigrationLog.messages.push(
            generateLog(
              'error',
              `Failed to upload ${fileName} - HTTP ${res.statusCode ?? 'UNKNOWN_CODE'} ${
                res.statusMessage ?? 'UNKNOWN_MESSAGE'
              } ${responseData}`
            )
          );
          resolve(); // Continue execution even if upload failed
        }
      });
    });

    // Handle low-level request errors
    req.on('error', (err) => {
      contentVersionMigrationLog.messages.push(generateLog('error', `Error uploading ${fileName}: ${err.message}`));
      commonParams.multiBar.remove(uploadBar);
      contentVersionMigrationLog.messages.push(generateLog('error', `Error uploading ${fileName} - ${err.message}`));
      resolve();
    });

    // Send the metadata and file content
    req.write(metadataPart);
    req.write(fileHeaderPart);
    const readStream = fs.createReadStream(sourceFilePath, { highWaterMark: 5 * 1024 * 1024 }); // stream in 5 MB chunks
    readStream.on('data', (chunk) => {
      if (!req.write(chunk)) {
        readStream.pause(); // backpressure: pause if request buffer is full
      }
      uploadedBytes += chunk.length;
      uploadBar.update(uploadedBytes);
    });
    req.on('drain', () => readStream.resume());
    readStream.on('end', () => {
      req.end(closingBoundary); // end the multipart request
    });
  });

  // Clean up the local file if we aren't preserving files locally
  if (!commonParams.isSaveFilesLocally) {
    try {
      fs.unlinkSync(sourceFilePath);
    } catch (e: unknown) {
      const message = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
      contentVersionMigrationLog.messages.push(
        generateLog('warning', `Could not delete temp file ${sourceFilePath} - ${message}`)
      );
    }
  }

  return contentVersionId || undefined;
}
