import { randomInt } from "node:crypto";

// No 0/O/1/I to keep serials easy to read out and type.
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function block(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARSET[randomInt(CHARSET.length)];
  }
  return result;
}

/** Certificate serial, e.g. LS-K3F9-KX2M-8PQZ */
export function makeSerial(): string {
  return `LS-${block(4)}-${block(4)}-${block(4)}`;
}
