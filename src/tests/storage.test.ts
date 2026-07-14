import { describe, expect, it } from "vitest";
import { createTask } from "../engine/taskFactory";
import { createEmptyData, createMemoryStorage, loadAppData, normaliseAppData, saveAppData, STORAGE_KEY } from "../storage/localStore";

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

  it("migrates old minute timer settings into seconds", () => {
    const data = normaliseAppData({
      settings: {
        defaultTimerMinutes: 10
      } as never
    });

    expect(data.settings.defaultTimerSeconds).toBe(600);
    expect("defaultTimerMinutes" in data.settings).toBe(false);
  });

  it("normalises timer settings to 30-second increments", () => {
    const low = normaliseAppData({ settings: { defaultTimerSeconds: 12 } as never });
    const rounded = normaliseAppData({ settings: { defaultTimerSeconds: 47 } as never });
    const high = normaliseAppData({ settings: { defaultTimerSeconds: 2000 } as never });

    expect(low.settings.defaultTimerSeconds).toBe(30);
    expect(rounded.settings.defaultTimerSeconds).toBe(60);
    expect(high.settings.defaultTimerSeconds).toBe(900);
  });
});
