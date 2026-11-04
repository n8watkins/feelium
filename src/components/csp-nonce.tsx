"use client";

import { setNonce } from "get-nonce";

/**
 * Hands the request's CSP nonce to libraries that inject <style> tags at runtime: Radix's
 * scroll lock (react-remove-scroll, via react-style-singleton) asks get-nonce for it when
 * a dialog opens. Without it the CSP blocks that style.
 */
export function CspNonce({ nonce }: { nonce?: string }) {
  if (nonce) setNonce(nonce);
  return null;
}
