import { EventEmitter } from 'events';
import net from 'net';
import sinon from 'sinon';

export function stubNetForFreePort(sandbox: sinon.SinonSandbox, ports: number[] = [40000, 40001, 40002]) {
  let callCount = 0;
  sandbox.stub(net, 'createServer').callsFake(() => {
    const server = new EventEmitter() as any;
    server.listen = (_port: number, _host: string) => {
      process.nextTick(() => server.emit('listening'));
      return server;
    };
    server.close = () => server.emit('close');
    server.address = () => ({ port: ports[Math.min(callCount++, ports.length - 1)] });
    return server;
  });
}
