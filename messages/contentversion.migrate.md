# summary

Migrate Salesforce Files (ContentDocument & ContentVersion records) from a source org to a target org. Preserving links to parent records.

# description

Transfers file attachments from a source Salesforce org to a target org. Recreates ContentDocumentLink associations so files appear on the corresponding target records.

# examples

sf contentversion migrate \
--source-org my-prod \
--target-org target-prod \
--source-object Account \
--target-object Account \
--source-id-field Id \
--target-id-field External_ID\_\_c \
--source-where-filter "Industry != null" \
--no-prompts
--json

# flags.source-org.summary

Source Salesforce org alias or username.

# flags.source-org.description

The alias or username of the **source** org (as authenticated in Salesforce CLI). Files will be retrieved from this org.

# flags.target-org.summary

Target Salesforce org alias or username.

# flags.target-org.description

The alias or username of the **target** org (as authenticated in Salesforce CLI). Files will be uploaded to this org.

# flags.source-object.summary

Source object API name.

# flags.source-object.description

API name of the object in the **source** org whose record file attachments you want to migrate (e.g. `Account`, `Case`).

# flags.target-object.summary

Target object API name.

# flags.target-object.description

API name of the object in the **target** org that corresponds to the source object.

# flags.source-id-field.summary

Source record identifier field.

# flags.source-id-field.description

Field name on the **source** object used to match records (e.g. `Id` or a custom external ID).

# flags.target-id-field.summary

Target record identifier field.

# flags.target-id-field.description

Field name on the **target** object used to match to source records (e.g. `External_ID__c`).

# flags.source-where-filter.summary

SOQL WHERE filter for source records.

# flags.source-where-filter.description

Optional SOQL filter clause to select a subset of source records (e.g. `"Industry != null"`). Defaults to all records if omitted.

# flags.downloads-path.summary

Local downloads directory.

# flags.downloads-path.description

Path to the folder where files are temporarily stored during migration. Defaults to the current working directory.

# flags.no-save-locally.summary

Skip saving files locally.

# flags.no-save-locally.description

Removes local files right after uploading to target org.

# flags.no-prompts.summary

Disable interactive prompts.

# flags.no-prompts.description

If set, the command runs in automated mode and skips all interactive prompts and confirmation messages.
