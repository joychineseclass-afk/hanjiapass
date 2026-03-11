export async function loadCharacters() {
  try {
    const res = await fetch("/data/characters/kids_default.json");
    const data = await res.json();
    return data.characters || [];
  } catch (e) {
    console.warn("[CharacterLoader] failed", e);
    return [];
  }
}

