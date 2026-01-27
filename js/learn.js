function showStrokeOrder(character) {
  const code = character.charCodeAt(0);
  const svgPath = `data/strokes/${code}.svg`;

  const viewer = document.getElementById("stroke-viewer");
  if (!viewer) return;

  viewer.innerHTML = `
    <object type="image/svg+xml" data="${svgPath}" width="220" height="220"></object>
  `;
}
