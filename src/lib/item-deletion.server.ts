type DeleteItemActions = {
  removeStorageObject: () => Promise<void>;
  deleteDatabaseRow: () => Promise<void>;
  writeAuditRecord: () => Promise<void>;
};

/**
 * Delete bytes before metadata so a failed object deletion never leaves an
 * untracked file in storage. If row deletion fails after storage succeeds, the
 * metadata remains and the operation can be reconciled/retried safely.
 */
export async function deleteItemStorageFirst(actions: DeleteItemActions): Promise<void> {
  await actions.removeStorageObject();
  await actions.deleteDatabaseRow();
  await actions.writeAuditRecord();
}
