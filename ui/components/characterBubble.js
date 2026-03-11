export function renderCharacterBubble(character, text) {
  const avatar = character?.avatar || "";
  const name = character?.name?.zh || "";

  return `
    <div class="lumina-char-bubble">
      <div class="lumina-char-head">
        <span class="lumina-char-avatar">${avatar}</span>
        <span class="lumina-char-name">${name}</span>
      </div>
      <div class="lumina-char-text">${text}</div>
    </div>
  `;
}

