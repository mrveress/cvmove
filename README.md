# cvmove

[![npm version](https://img.shields.io/npm/v/@adampetrovich/cvmove.svg)](https://www.npmjs.com/package/@adampetrovich/cvmove)
[![Downloads/week](https://img.shields.io/npm/dw/@adampetrovich/cvmove.svg)](https://www.npmjs.com/package/@adampetrovich/cvmove)
[![License](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](LICENSE)

## Overview

**cvmove** is a Salesforce CLI plugin that migrates Files (ContentDocument and ContentVersion records) between Salesforce orgs while preserving their parent relationships.

## Installation

```
sf plugins install @adampetrovich/cvmove
```

## Usage

### Migrate files between orgs

```
sf contentversion migrate --source-org my-src --target-org my-target [flags]
```

#### Flags

- `--source-org` _(required)_: source Salesforce org alias or username.
- `--target-org` _(required)_: target Salesforce org alias or username.
- `--source-object`: API name of the source object to migrate files from.
- `--target-object`: API name of the corresponding target object.
- `--source-id-field`: field on the source object used to identify records.
- `--target-id-field`: field on the target object used to match to source records.
- `--source-where-filter`: SOQL `WHERE` clause to filter source records.
- `--downloads-path`: local directory for temporary file storage.
- `--no-save-locally`: delete downloaded file (local) right after uploading to target orgs.
- `--no-prompts`: run the command in non-interactive mode.

## Example

Migrate Account file attachments:

```
sf contentversion migrate \
  --source-org my-prod \
  --target-org target-prod \
  --source-object Account \
  --target-object Account \
  --source-id-field Id \
  --target-id-field External_Id__c
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This plugin is licensed under the [BSD 3-Clause License](LICENSE).
