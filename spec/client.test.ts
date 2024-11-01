import assert from 'assert/strict';
import * as commons from '@elastic.io/component-commons-library';
import { describe, it, beforeEach, mock, afterEach } from 'node:test';
import { getContext, StatusCodeError } from './common';
import Client from '../src/Client';
import { Cfg } from '../src/utils';

const fakeResponse: any = {
  data: '123',
  headers: {
    h1: 'qwe'
  },
  status: 200
};

describe('"Client (axios)"', async () => {
  let cfg: Cfg = {
    reader: {
      method: 'GET',
      url: '"localhost"',
      headers: [{ key: 'key', value: '"value"' }]
    },
    secretId: '123',
    credentials: { fields: '' }
  };
  const msg = { body: {} };
  let execRequest;
  const context = getContext();
  const client = new Client(context, cfg, msg);
  describe('getOptions', async () => {
    beforeEach(() => {
    });
    afterEach(() => {
      mock.restoreAll();
    });
    it('no body', async () => {
      client.setCfgAndMsg(cfg, msg);
      const options = await client.getOptions();
      assert.deepEqual(options, {
        method: 'GET',
        url: 'localhost',
        headers: { key: 'value' },
      });
    });
    it('application/x-www-form-urlencoded', async () => {
      cfg = {
        reader: {
          method: 'GET',
          url: '"localhost"',
          headers: [{ key: 'key', value: '"value"' }],
          body: {
            contentType: 'application/x-www-form-urlencoded',
            urlencoded: [{ key: 'param1', value: '"value1"' }]
          }
        },
        secretId: '123',
        credentials: { fields: '' }
      };
      client.setCfgAndMsg(cfg, msg);
      const options = await client.getOptions();
      assert.deepEqual(options, {
        method: 'GET',
        url: 'localhost',
        headers: { key: 'value' },
        params: new URLSearchParams({ param1: 'value1' })
      });
    });
    it('multipart/form-data - uploadFile', async () => {
      execRequest = mock.method(commons.AttachmentProcessor.prototype, 'getAttachment');
      execRequest.mock.mockImplementation(async () => ({ data: 'attach' }));
      cfg = {
        reader: {
          method: 'POST',
          url: '"localhost"',
          headers: [{ key: 'key', value: '"value"' }],
          body: {
            contentType: 'multipart/form-data',
            formData: [{ key: 'file', value: '{"url":"file-url?source=maester","knownLength":12345,"filename":"test.txt"}' }],
          }
        },
        uploadFile: true,
        secretId: '123',
        credentials: { fields: '' }
      };
      client.setCfgAndMsg(cfg, msg);
      const options = await client.getOptions();
      assert.strictEqual(options.method, 'POST');
      assert.strictEqual(options.url, 'localhost');
      assert.strictEqual(options.headers?.['content-length'], 12551);
      assert.strictEqual(options.headers.key, 'value');
      assert.strictEqual(execRequest.mock.callCount(), 1);
      assert.strictEqual(execRequest.mock.calls[0].arguments[0], 'file-url?source=maester');
    });
    it('application/octet-stream - uploadFile', async () => {
      execRequest = mock.method(commons.AttachmentProcessor.prototype, 'getAttachment');
      execRequest.mock.mockImplementation(async () => ({ data: 'attach' }));
      cfg = {
        reader: {
          method: 'POST',
          url: '"localhost"',
          headers: [{ key: 'key', value: '"value"' }],
          body: {
            contentType: 'application/octet-stream',
            raw: '"file-url?source=maester"',
          }
        },
        uploadFile: true,
        secretId: '123',
        credentials: { fields: '' }
      };
      client.setCfgAndMsg(cfg, msg);
      const options = await client.getOptions();
      assert.strictEqual(options.method, 'POST');
      assert.strictEqual(options.url, 'localhost');
      assert.strictEqual(options.headers?.key, 'value');
      assert.strictEqual(execRequest.mock.callCount(), 1);
      assert.strictEqual(execRequest.mock.calls[0].arguments[0], 'file-url?source=maester');
    });
    it('raw body', async () => {
      cfg = {
        reader: {
          method: 'GET',
          url: '"localhost"',
          headers: [{ key: 'key', value: '"value"' }],
          body: {
            contentType: 'application/json',
            raw: '{"key":"value"}',
          }
        },
        secretId: '123',
        credentials: { fields: '' }
      };
      client.setCfgAndMsg(cfg, msg);
      const options = await client.getOptions();
      assert.deepEqual(options, {
        method: 'GET',
        url: 'localhost',
        headers: { key: 'value' },
        data: { key: 'value' }
      });
    });
  });
  describe('apiRequest', async () => {
    beforeEach(() => {
    });
    afterEach(() => {
      mock.restoreAll();
    });
    it('Get response', async () => {
      mock.method(Client.prototype, 'getNewSecret').mock.mockImplementation(async () => fakeResponse);
      mock.method(Client.prototype, 'addAuthentication').mock.mockImplementation(async () => fakeResponse);
      client.ax = mock.fn();
      await client.apiRequest();
      const ax = client.ax as any;
      assert.deepEqual(ax.mock.calls[0].arguments[0], {
        data: { key: 'value' },
        headers: { key: 'value' },
        method: 'GET',
        url: 'localhost'
      });
    });
    it('Got 429 - default retry (Retry by component)', async () => {
      mock.method(Client.prototype, 'getNewSecret').mock.mockImplementationOnce(async () => fakeResponse, 0);
      mock.method(Client.prototype, 'addAuthentication').mock.mockImplementation(async () => fakeResponse);
      const clientAsAny = client as any;
      clientAsAny.ax = mock.fn();
      clientAsAny.ax.mock.mockImplementationOnce(async () => { throw new StatusCodeError(429); }, 0);
      clientAsAny.ax.mock.mockImplementationOnce(async () => fakeResponse, 1);
      const additionalOptions = { maxRetries: 2 };
      clientAsAny.setCfgAndMsg({ ...cfg, ...additionalOptions }, msg);
      await clientAsAny.apiRequest();
      assert.strictEqual(clientAsAny.ax.mock.callCount(), 2);
    });
    it('Got 404 - default retry (Retry by component), custom code', async () => {
      mock.method(Client.prototype, 'getNewSecret').mock.mockImplementationOnce(async () => fakeResponse, 0);
      mock.method(Client.prototype, 'addAuthentication').mock.mockImplementation(async () => fakeResponse);
      const clientAsAny = client as any;
      clientAsAny.ax = mock.fn();
      clientAsAny.ax.mock.mockImplementationOnce(async () => { throw new StatusCodeError(404); }, 0);
      clientAsAny.ax.mock.mockImplementationOnce(async () => fakeResponse, 1);
      const additionalOptions = { maxRetries: 2, errorCodes: '404' };
      clientAsAny.setCfgAndMsg({ ...cfg, ...additionalOptions }, msg);
      await clientAsAny.apiRequest();
      assert.strictEqual(clientAsAny.ax.mock.callCount(), 2);
    });
    it('Got 429 - Rebound', async () => {
      mock.method(Client.prototype, 'getNewSecret').mock.mockImplementationOnce(async () => fakeResponse, 0);
      mock.method(Client.prototype, 'addAuthentication').mock.mockImplementation(async () => fakeResponse);
      const clientAsAny = client as any;
      clientAsAny.ax = mock.fn();
      clientAsAny.ax.mock.mockImplementationOnce(async () => { throw new StatusCodeError(429); }, 0);
      clientAsAny.ax.mock.mockImplementationOnce(async () => fakeResponse, 1);
      const additionalOptions = { maxRetries: 2, errorPolicy: 'rebound' };
      clientAsAny.setCfgAndMsg({ ...cfg, ...additionalOptions }, msg);
      const result = await clientAsAny.apiRequest();
      assert.strictEqual(result, 'rebound');
      assert.strictEqual(clientAsAny.ax.mock.callCount(), 1);
    });
    it('Got 429 - throwError', async () => {
      mock.method(Client.prototype, 'getNewSecret').mock.mockImplementationOnce(async () => fakeResponse, 0);
      mock.method(Client.prototype, 'addAuthentication').mock.mockImplementation(async () => fakeResponse);
      const clientAsAny = client as any;
      clientAsAny.ax = mock.fn();
      clientAsAny.ax.mock.mockImplementationOnce(async () => { throw new StatusCodeError(429); }, 0);
      clientAsAny.ax.mock.mockImplementationOnce(async () => fakeResponse, 1);
      const additionalOptions = { maxRetries: 2, errorPolicy: 'throwError' };
      clientAsAny.setCfgAndMsg({ ...cfg, ...additionalOptions }, msg);
      await assert.rejects(clientAsAny.apiRequest(), { message: 'Got error "unknown", status - "429", body: "no body found"' });
    });
  });
  describe('parseCustomErrorCodesRange', async () => {
    beforeEach(() => {
    });
    afterEach(() => {
      mock.restoreAll();
    });
    it('404', async () => {
      const additionalOptions = { errorCodes: '404' };
      client.setCfgAndMsg({ ...cfg, ...additionalOptions }, msg);
      const codes = client.parseCustomErrorCodesRange();
      assert.deepEqual(codes, [404]);
    });
    it('401-404', async () => {
      const additionalOptions = { errorCodes: '401-404' };
      client.setCfgAndMsg({ ...cfg, ...additionalOptions }, msg);
      const codes = client.parseCustomErrorCodesRange();
      assert.deepEqual(codes, [401, 402, 403, 404]);
    });
    it('401, 501-503, 402', async () => {
      const additionalOptions = { errorCodes: '401, 501-503, 402' };
      client.setCfgAndMsg({ ...cfg, ...additionalOptions }, msg);
      const codes = client.parseCustomErrorCodesRange();
      assert.deepEqual(codes, [401, 501, 502, 503, 402]);
    });
  });
  describe('createAxiosInstance', async () => {
    beforeEach(() => {
    });
    afterEach(() => {
      mock.restoreAll();
    });
    it('invalid Request timeout', async () => {
      const additionalOptions = { requestTimeoutPeriod: '0' };
      await assert.rejects(async () => new Client(context, { ...cfg, ...additionalOptions }, msg), { message: '"Request timeout" must be valid number between 1 and 1140000' });
    });
    it('invalid Maximum redirects', async () => {
      const additionalOptions = { maxRedirects: '11' };
      await assert.rejects(async () => new Client(context, { ...cfg, ...additionalOptions }, msg), { message: '"Maximum redirects" must be valid number between 0 and 10' });
    });
    it('invalid Request size limit', async () => {
      const additionalOptions = { maxBodyLength: '0' };
      await assert.rejects(async () => new Client(context, { ...cfg, ...additionalOptions }, msg), { message: '"Request size limit" must be valid number between 1 and Infinity' });
    });
    it('invalid Response size limit', async () => {
      const additionalOptions = { maxContentLength: '209715200' };
      await assert.rejects(async () => new Client(context, { ...cfg, ...additionalOptions }, msg), { message: '"Response size limit" must be valid number between 1 and 20971520' });
    });
  });
});
