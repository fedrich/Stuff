// Cronologia non distruttiva: ogni voce è una copia completa dei parametri, mai dei pixel.
const LIMIT = 100;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export class History {
  constructor(initial) { this.reset(initial); }
  reset(s) { this.list = [JSON.parse(JSON.stringify(s))]; this.i = 0; }
  push(s) {
    if (same(s, this.list[this.i])) return;
    this.list = this.list.slice(0, this.i + 1);
    this.list.push(JSON.parse(JSON.stringify(s)));
    if (this.list.length > LIMIT) this.list.shift();
    this.i = this.list.length - 1;
  }
  canUndo() { return this.i > 0; }
  canRedo() { return this.i < this.list.length - 1; }
  undo() { if (!this.canUndo()) return null; return this.list[--this.i]; }
  redo() { if (!this.canRedo()) return null; return this.list[++this.i]; }
  // Ultima voce (andando indietro dalla posizione corrente) in cui il selettore dà un valore diverso da quello attuale.
  previousFor(select, current) {
    const cur = select(current);
    for (let j = this.i; j >= 0; j--) if (select(this.list[j]) !== cur) return this.list[j];
    return null;
  }
}
