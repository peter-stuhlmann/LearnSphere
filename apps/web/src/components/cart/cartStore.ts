"use client";

/**
 * Warenkorb im localStorage ("ls-cart"): kleiner externer Store für
 * useSyncExternalStore. Snapshot wird gecacht, damit React stabile
 * Referenzen bekommt; Änderungen anderer Tabs kommen über "storage".
 */

export interface CartItem {
  courseId: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  coverImage: string | null;
}

const STORAGE_KEY = "ls-cart";
const listeners = new Set<() => void>();
let cache: CartItem[] | null = null;

function read(): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]"
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CartItem).courseId === "string" &&
        typeof (item as CartItem).priceCents === "number"
    );
  } catch {
    return [];
  }
}

function write(items: CartItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Speicher voll/blockiert → Warenkorb gilt nur für diese Sitzung
  }
  cache = items;
  for (const listener of listeners) listener();
}

export function getCartItems(): CartItem[] {
  if (cache === null) cache = read();
  return cache;
}

const EMPTY: CartItem[] = [];
export function getCartServerSnapshot(): CartItem[] {
  return EMPTY;
}

export function subscribeCart(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function addToCart(item: CartItem): void {
  const items = getCartItems();
  if (items.some((existing) => existing.courseId === item.courseId)) return;
  write([...items, item]);
}

export function removeFromCart(courseId: string): void {
  write(getCartItems().filter((item) => item.courseId !== courseId));
}

export function clearCart(): void {
  write([]);
}
