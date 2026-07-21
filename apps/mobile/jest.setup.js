/* eslint-env jest */

// expo-secure-store: In-Memory-Mock (Keychain existiert im Test nicht)
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
  };
});

// expo-localization: deterministische Gerätesprache
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "de" }],
}));
