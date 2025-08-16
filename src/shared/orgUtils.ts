import { Connection } from '@salesforce/core';
import { select, input } from '@inquirer/prompts';
import { DescribeSObjectResult, Field } from 'jsforce';
import { API_VERSION } from './constants.js';

type SObjectItem = {
  name: string;
  value: string;
};

export async function getSObjectList(connection: Connection): Promise<SObjectItem[]> {
  const sObjects: SObjectItem[] = (
    await connection.metadata.list([{ type: 'CustomObject', folder: null }], '64.0')
  ).map((metadata) => ({
    name: metadata.fullName,
    value: metadata.fullName,
  }));
  sObjects.sort((a, b) => a.name.localeCompare(b.name));
  return sObjects;
}

export function selectSObject(label: string, sObjectApiNames: SObjectItem[]): Promise<string> {
  return select({
    message: `Select ${label} SObject`,
    choices: sObjectApiNames,
  });
}

export async function selectSObjectField(
  label: string,
  connection: Connection,
  sObjectApiName: string,
  filterFn: (value: Field, index: number, array: Field[]) => boolean
): Promise<string> {
  const fields = (
    await connection.request<DescribeSObjectResult>(
      `/services/data/v${API_VERSION}/sobjects/${sObjectApiName}/describe/`
    )
  ).fields
    .filter(filterFn)
    .map((field) => ({
      name: `${field.label} [${field.name}]`,
      value: field.name,
      description: field.type,
    }));

  fields.sort((a, b) => a.name.localeCompare(b.name));

  return select({
    message: `Select ${label} on ${sObjectApiName}`,
    choices: fields,
  });
}

export async function getSoqlWhereFilter(label: string, defaultWhere: string): Promise<string> {
  return input({
    message: `Enter a ${label}`,
    default: defaultWhere,
  });
}
