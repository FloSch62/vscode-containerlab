let hostname = 'localhost';
let sessionHostname: string | undefined;

export function setHostname(h: string): void {
  hostname = h;
}

export function setSessionHostname(h: string | undefined): void {
  sessionHostname = h;
}

export async function getHostname(): Promise<string> {
  return sessionHostname ?? hostname;
}

export function resetPacketflixStub(): void {
  hostname = 'localhost';
  sessionHostname = undefined;
}
