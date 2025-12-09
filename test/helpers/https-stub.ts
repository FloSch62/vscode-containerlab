import { EventEmitter } from 'events';

export interface MockResponse extends EventEmitter {
  statusCode?: number;
  headers?: Record<string, string>;
}

export interface MockRequest extends EventEmitter {
  end: () => void;
  abort: () => void;
}

export interface GetOptions {
  headers?: Record<string, string>;
}

type GetCallback = (res: MockResponse) => void;

let mockResponseData: string | null = null;
let mockError: Error | null = null;
let mockStatusCode: number = 200;

export function setMockResponseData(data: string, statusCode: number = 200): void {
  mockResponseData = data;
  mockError = null;
  mockStatusCode = statusCode;
}

export function setMockError(error: Error): void {
  mockError = error;
  mockResponseData = null;
}

export function resetMock(): void {
  mockResponseData = null;
  mockError = null;
  mockStatusCode = 200;
}

function emitResponseData(res: MockResponse, data: string | null): void {
  if (data) {
    process.nextTick(() => {
      res.emit('data', Buffer.from(data));
      process.nextTick(() => {
        res.emit('end');
      });
    });
  } else {
    process.nextTick(() => {
      res.emit('end');
    });
  }
}

export function get(_url: string | URL, optionsOrCallback?: GetOptions | GetCallback, callback?: GetCallback): MockRequest {
  let cb: GetCallback;

  if (typeof optionsOrCallback === 'function') {
    cb = optionsOrCallback;
  } else if (callback) {
    cb = callback;
  } else {
    throw new Error('No callback provided');
  }

  const req = new EventEmitter() as MockRequest;
  req.end = () => {
    // Simulate async behavior
    process.nextTick(() => {
      if (mockError) {
        req.emit('error', mockError);
      } else {
        const res = new EventEmitter() as MockResponse;
        res.statusCode = mockStatusCode;
        res.headers = { 'content-type': 'application/json' };

        cb(res);

        // Emit data in chunks to simulate real HTTP response
        emitResponseData(res, mockResponseData);
      }
    });
  };

  req.abort = () => {
    // no-op
  };

  return req;
}
