/**
 * webviewMessageBus - Single window.message listener with fan-out subscriptions.
 *
 * The webview previously registered multiple `window.addEventListener('message', ...)` listeners
 * across hooks and services. This module centralizes the listener and allows scoped subscriptions.
 */

/**
 * Base webview message structure from the extension.
 * All messages have a type field, and may have additional data.
 */
export interface WebviewMessageBase {
  type: string;
  [key: string]: unknown;
}

/**
 * Typed MessageEvent with known data structure
 */
export type TypedMessageEvent = MessageEvent<WebviewMessageBase | undefined>;

export type WebviewMessagePredicate = (event: TypedMessageEvent) => boolean;
export type WebviewMessageHandler = (event: TypedMessageEvent) => void;

interface Subscriber {
  handler: WebviewMessageHandler;
  predicate?: WebviewMessagePredicate;
}

let started = false;
let windowListener: ((event: TypedMessageEvent) => void) | null = null;
const subscribers = new Set<Subscriber>();

function isTrustedMessage(event: TypedMessageEvent): boolean {
  if (event.source !== window && event.source !== null) return false;
  if (event.origin !== window.location.origin) return false;
  if (typeof event.data !== "object" || event.data === null) return false;
  const data = event.data as Record<string, unknown>;
  return typeof data.type === "string";
}

function ensureStarted(): void {
  if (started) return;
  windowListener = (event: TypedMessageEvent) => {
    if (!isTrustedMessage(event)) return;
    for (const sub of Array.from(subscribers)) {
      if (!sub.predicate || sub.predicate(event)) {
        sub.handler(event);
      }
    }
  };

  window.addEventListener("message", windowListener);
  started = true;
}

function maybeStop(): void {
  if (!started) return;
  if (subscribers.size > 0) return;
  if (!windowListener) return;
  window.removeEventListener("message", windowListener);
  windowListener = null;
  started = false;
}

export function subscribeToWebviewMessages(
  handler: WebviewMessageHandler,
  predicate?: WebviewMessagePredicate
): () => void {
  ensureStarted();
  const sub: Subscriber = { handler, predicate };
  subscribers.add(sub);
  return () => {
    subscribers.delete(sub);
    maybeStop();
  };
}
