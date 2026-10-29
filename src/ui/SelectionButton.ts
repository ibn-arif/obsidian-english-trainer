/** Small floating «+ в словарь» button shown next to a text selection. */
export class SelectionButton {
  private el: HTMLButtonElement;

  constructor(onPress: () => void) {
    this.el = document.body.createEl("button", { cls: "et-sel-btn" });
    this.el.hide();
    // keep the selection alive: don't let the press steal focus
    const keep = (e: Event) => e.preventDefault();
    this.el.addEventListener("mousedown", keep);
    this.el.addEventListener("touchstart", keep, { passive: false });
    this.el.addEventListener("touchend", (e) => {
      e.preventDefault();
      onPress();
    });
    this.el.addEventListener("click", () => onPress());
  }

  show(rect: DOMRect, label: string): void {
    this.el.setText(label);
    this.el.show();
    const w = this.el.offsetWidth || 140;
    const h = this.el.offsetHeight || 36;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left + rect.width / 2 - w / 2));
    // below the selection (the iOS callout menu sits above it); above if there is no room
    const below = rect.bottom + 10;
    const top = below + h < window.innerHeight - 8 ? below : Math.max(8, rect.top - h - 10);
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  hide(): void {
    this.el.hide();
  }

  destroy(): void {
    this.el.remove();
  }
}
