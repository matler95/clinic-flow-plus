import { describe, expect, it } from "vitest";
import { deleteItemStorageFirst } from "../item-deletion.server";

describe("deleteItemStorageFirst", () => {
  it("removes bytes, then the row, then writes the audit record", async () => {
    const actions: string[] = [];

    await deleteItemStorageFirst({
      removeStorageObject: async () => { actions.push("storage"); },
      deleteDatabaseRow: async () => { actions.push("database"); },
      writeAuditRecord: async () => { actions.push("audit"); },
    });

    expect(actions).toEqual(["storage", "database", "audit"]);
  });

  it("preserves the database row and skips audit if storage removal fails", async () => {
    const actions: string[] = [];

    await expect(deleteItemStorageFirst({
      removeStorageObject: async () => {
        actions.push("storage");
        throw new Error("storage unavailable");
      },
      deleteDatabaseRow: async () => { actions.push("database"); },
      writeAuditRecord: async () => { actions.push("audit"); },
    })).rejects.toThrow("storage unavailable");

    expect(actions).toEqual(["storage"]);
  });

  it("keeps the row when database deletion fails after bytes are removed", async () => {
    const actions: string[] = [];

    await expect(deleteItemStorageFirst({
      removeStorageObject: async () => { actions.push("storage"); },
      deleteDatabaseRow: async () => {
        actions.push("database");
        throw new Error("database unavailable");
      },
      writeAuditRecord: async () => { actions.push("audit"); },
    })).rejects.toThrow("database unavailable");

    expect(actions).toEqual(["storage", "database"]);
  });
});
