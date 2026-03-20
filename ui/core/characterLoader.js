import { fetchJsonCached } from "./fetchJsonCached.js";

export async function loadCharacters() {
  try {
    const data = await fetchJsonCached("/data/characters/kids_default.json", { cache: "no-store" });
    return data.characters || [];
  } catch (e) {
    console.warn("[CharacterLoader] failed", e);
    return [];
  }
}

