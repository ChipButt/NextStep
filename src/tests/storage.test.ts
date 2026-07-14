import { describe, expect, it } from "vitest";
import { createTask } from "../engine/taskFactory";
import { createEmptyData, createMemoryStorage, loadAppData, saveAppData, STORAGE_KEY } from "../storage/localStore";

describe("local persistence", () => {
  it("keeps local data available after a simulated refresh", () => {
    const storage = createMemoryStorage();
    const data = createEmptyData();
    data.tasks = [createTask({ title: "Put a load of washing on" })];

    saveAppData(data, storage);
    const loaded = loadAppData(storage);

    expect(storage.getItem(STORAGE_KEY)).toContain("Put a load of washing on");
    expect(loaded.tasks[0].title).toBe("Put a load of washing on");
  });
});
