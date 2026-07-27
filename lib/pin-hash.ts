/**
 * PIN disimpan sebagai plaintext (tanpa hash).
 */
export function hashPin(pin: string): string {
  return pin;
}

/**
 * Verifikasi PIN secara langsung (plaintext).
 */
export function verifyPin(pin: string, storedPin: string): boolean {
  return pin === storedPin;
}

/**
 * Tidak perlu rehash karena PIN sudah plaintext.
 */
export function needsRehash(_storedPin: string): boolean {
  return false;
}
