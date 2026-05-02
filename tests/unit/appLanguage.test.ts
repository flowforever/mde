import { describe, expect, it, vi } from "vitest";

import {
  APP_CUSTOM_LANGUAGE_PACKS_STORAGE_KEY,
  APP_LANGUAGE_STORAGE_KEY,
  BUILT_IN_APP_LANGUAGE_PACKS,
  createAppLanguagePackEntries,
  createAppText,
  createCustomAppLanguagePack,
  getAppLanguagePack,
  isCustomAppLanguagePack,
  readAppLanguagePreference,
  readCustomAppLanguagePacks,
  resolveSystemAppLanguageId,
  writeAppLanguagePreference,
  writeCustomAppLanguagePacks,
} from "../../src/renderer/src/i18n/appLanguage";

describe("app language preferences", () => {
  it("selects Chinese for Chinese system locales and English otherwise", () => {
    expect(resolveSystemAppLanguageId(["zh-CN", "en-US"])).toBe("zh");
    expect(resolveSystemAppLanguageId(["en-US", "zh-Hans-CN"])).toBe("en");
    expect(resolveSystemAppLanguageId("zh-Hant-TW")).toBe("zh");
    expect(resolveSystemAppLanguageId(["fr-FR", "en-US"])).toBe("en");
    expect(resolveSystemAppLanguageId(undefined)).toBe("en");
  });

  it("lets a stored supported language override the system locale", () => {
    const storage = {
      getItem: vi.fn().mockReturnValue("en"),
      setItem: vi.fn(),
    };

    expect(readAppLanguagePreference(storage, ["zh-CN"])).toBe("en");
    expect(storage.getItem).toHaveBeenCalledWith(APP_LANGUAGE_STORAGE_KEY);
  });

  it("falls back to the system locale for invalid stored languages", () => {
    expect(
      readAppLanguagePreference({ getItem: () => "pirate" }, ["zh-CN"]),
    ).toBe("zh");
    expect(readAppLanguagePreference({ getItem: () => null }, ["en-US"])).toBe(
      "en",
    );
  });

  it("writes selected app language preferences", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };

    writeAppLanguagePreference(storage, "zh");

    expect(storage.setItem).toHaveBeenCalledWith(
      APP_LANGUAGE_STORAGE_KEY,
      "zh",
    );
  });

  it("keeps built-in language packs structurally complete", () => {
    const englishKeys = Object.keys(
      BUILT_IN_APP_LANGUAGE_PACKS.en.messages,
    ).sort();
    const chineseKeys = Object.keys(
      BUILT_IN_APP_LANGUAGE_PACKS.zh.messages,
    ).sort();

    expect(chineseKeys).toEqual(englishKeys);
    expect(englishKeys.length).toBeGreaterThan(80);
  });

  it("covers document history text in English and Chinese", () => {
    const englishText = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en);
    const chineseText = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.zh);

    expect(englishText("history.versionHistory")).toBe("Version history");
    expect(englishText("history.deletedDocuments")).toBe("Deleted Documents");
    expect(englishText("history.panelTitle")).toBe("Document history");
    expect(englishText("history.noVersions")).toBe("No versions yet");
    expect(englishText("history.emptyAutosaveConfirm")).toContain(
      "clear this document",
    );
    expect(chineseText("history.versionHistory")).toBe("版本历史");
    expect(chineseText("history.deletedDocuments")).toBe("已删除文档");
    expect(chineseText("history.panelTitle")).toBe("文档历史");
    expect(chineseText("history.noVersions")).toBe("暂无版本");
    expect(chineseText("history.emptyAutosaveConfirm")).toContain("清空文档");
  });

  it("formats parameterized language pack text", () => {
    const text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en);

    expect(
      text("workspace.switchToResource", {
        name: "Docs",
        resourceType: "workspace",
      }),
    ).toBe("Switch to workspace Docs");
  });

  it("stores and restores generated custom language packs", () => {
    const entries = createAppLanguagePackEntries(
      BUILT_IN_APP_LANGUAGE_PACKS.en,
    );
    const customPack = createCustomAppLanguagePack("Español", entries);
    const storedValues = new Map<string, string>();
    const storage = {
      getItem: (key: string) => storedValues.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storedValues.set(key, value);
      },
    };

    writeCustomAppLanguagePacks(storage, [customPack]);

    expect(storedValues.get(APP_CUSTOM_LANGUAGE_PACKS_STORAGE_KEY)).toContain(
      "Español",
    );
    expect(readCustomAppLanguagePacks(storage)).toEqual([customPack]);
    expect(getAppLanguagePack(customPack.id, [customPack])).toEqual(customPack);
    expect(isCustomAppLanguagePack(customPack)).toBe(true);
    expect(isCustomAppLanguagePack(BUILT_IN_APP_LANGUAGE_PACKS.en)).toBe(
      false,
    );
  });

  it("recovers custom language packs with missing generated keys", () => {
    const customPack = createCustomAppLanguagePack("Deutsch", [
      { key: "settings.title", text: "Einstellungen" },
    ]);
    const text = createAppText(customPack);

    expect(text("settings.title")).toBe("Einstellungen");
    expect(text("settings.close")).toBe("Close settings");
  });
});
