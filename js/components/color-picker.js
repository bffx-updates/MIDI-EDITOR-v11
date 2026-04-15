export const BFMIDI_COLOR_PALETTE = [
  "#ff0000", // 0  - VERMELHO
  "#00ff00", // 1  - VERDE
  "#0000ff", // 2  - AZUL
  "#ffff00", // 3  - AMARELO
  "#800080", // 4  - ROXO
  "#00ffff", // 5  - CYAN
  "#ffffff", // 6  - BRANCO
  "#ff5000", // 7  - LARANJA
  "#ff0080", // 8  - MAGENTA
  "#ff1414", // 9  - CORAL
  "#0096ff", // 10 - AZUL CELESTE
  "#b400ff", // 11 - VIOLETA
  "#ff64c8", // 12 - ROSA
  "#32ff64", // 13 - MENTA
  "#000000", // 14 - PRETO
];

export function mountColorPicker(container, currentValue, onChange) {
  if (!container) {
    return;
  }

  container.innerHTML = "";
  container.classList.add("palette");

  BFMIDI_COLOR_PALETTE.forEach((color, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.style.background = color;
    button.title = `Cor ${index}`;
    if (index === currentValue) {
      button.classList.add("is-selected");
    }
    button.addEventListener("click", () => onChange(index));
    container.appendChild(button);
  });
}
