import assert from 'assert/strict';
import * as commons from '@elastic.io/component-commons-library';
import { describe, it, beforeEach, mock, afterEach } from 'node:test';
import { getContext } from '../common';
import Client from '../../src/Client';
import { processAction } from '../../src/actions/httpRequest';
import { Cfg } from '../../src/utils';

const fakeResponse: any = {
  data: '123',
  headers: {
    h1: 'qwe'
  },
  status: 200
};

describe('"HTTP request (axios)" action', async () => {
  let execRequest;
  describe('should succeed', async () => {
    beforeEach(() => {
    });
    afterEach(() => {
      mock.restoreAll();
    });
    it('GET some data', async () => {
      execRequest = mock.method(Client.prototype, 'apiRequest');
      execRequest.mock.mockImplementation(async () => fakeResponse);
      const cfg: Cfg = {
        reader: {
          method: 'GET',
          url: 'localhost'
        },
        secretId: '123',
        credentials: { fields: '' }
      };
      const msg = { };
      const context = getContext();
      const { body } = await processAction.call(context, msg, cfg);
      assert.strictEqual(execRequest.mock.callCount(), 1);
      assert.deepEqual(body, {
        HTTPHeaders: fakeResponse.headers,
        responseBody: fakeResponse.data,
        statusCode: fakeResponse.status,
      });
    });
    it('GET file', async () => {
      execRequest = mock.method(Client.prototype, 'apiRequest');
      execRequest.mock.mockImplementation(async () => fakeResponse);
      execRequest = mock.method(commons.AttachmentProcessor.prototype, 'uploadAttachment');
      execRequest.mock.mockImplementation(async () => 'attachId');
      const cfg: Cfg = {
        reader: {
          method: 'GET',
          url: 'localhost'
        },
        secretId: '123',
        credentials: { fields: '' },
        downloadAsAttachment: true
      };
      const msg = { };
      const context = getContext();
      const { body } = await processAction.call(context, msg, cfg);
      assert.strictEqual(execRequest.mock.callCount(), 1);
      assert.deepEqual(body, {
        HTTPHeaders: fakeResponse.headers,
        attachmentUrl: '/objects/attachId?storage_type=maester',
        statusCode: fakeResponse.status,
      });
    });
    it('Rebound', async () => {
      execRequest = mock.method(Client.prototype, 'apiRequest');
      execRequest.mock.mockImplementation(async () => 'rebound');
      const cfg: Cfg = {
        reader: {
          method: 'GET',
          url: 'localhost'
        },
        secretId: '123',
        credentials: { fields: '' }
      };
      const msg = { };
      const context = getContext();
      const result = await processAction.call(context, msg, cfg);
      assert.strictEqual(result, null);
      assert.strictEqual(result, null);
      assert.deepEqual(context.emit.mock.calls[0].arguments[0], 'rebound');
      assert.deepEqual(context.emit.mock.calls[0].arguments[1], new Error('Rebound due to an error'));
    });
  });
});
