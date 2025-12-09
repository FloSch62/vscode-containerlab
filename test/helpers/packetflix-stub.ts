let hostname = 'localhost';
let sessionHostname: string | undefined;
let genPacketflixURIResult: [string, string] | undefined = ['packetflix:ws://localhost:5001/capture', 'localhost'];

export function setHostname(h: string): void {
  hostname = h;
}

export function setSessionHostname(h: string | undefined): void {
  sessionHostname = h;
}

export async function getHostname(): Promise<string> {
  return sessionHostname ?? hostname;
}

export function setGenPacketflixURIResult(result: [string, string] | undefined): void {
  genPacketflixURIResult = result;
}

export async function genPacketflixURI(
  _selectedNodes: any[],
  _forVNC?: boolean
): Promise<[string, string] | undefined> {
  return genPacketflixURIResult;
}

export function resetPacketflixStub(): void {
  hostname = 'localhost';
  sessionHostname = undefined;
  genPacketflixURIResult = ['packetflix:ws://localhost:5001/capture', 'localhost'];
}
