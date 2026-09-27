class LocalStorageMock {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

Object.defineProperty(globalThis, 'localStorage', { value: new LocalStorageMock(), configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: new LocalStorageMock(), configurable: true });

if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    configurable: true,
  });
}
if (typeof (globalThis as { location?: { origin: string } }).location === 'undefined') {
  Object.defineProperty(globalThis, 'location', {
    value: { origin: 'http://localhost:5173', href: 'http://localhost:5173/' },
    configurable: true,
  });
}

if (typeof document === 'undefined') {
  const node = () => ({ style: {}, setAttribute() {}, appendChild() {}, removeChild() {} });
  Object.defineProperty(globalThis, 'document', {
    value: {
      head: node(),
      body: node(),
      documentElement: { lang: 'fr' },
      createElement: node,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    configurable: true,
  });
}
