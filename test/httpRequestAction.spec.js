/* eslint-disable no-unused-vars,arrow-parens */

const { JsonataTransform } = require('@elastic.io/component-commons-library');
const sinon = require('sinon');
const { expect } = require('chai');
const nock = require('nock');
const fs = require('fs');
const { messages } = require('elasticio-node');
const logger = require('@elastic.io/component-logger')();
const client = require('elasticio-rest-node')();

const { stub } = sinon;

const processAction = require('../lib/actions/httpRequestAction').process;

function setSecretStub(secret) {
  nock(process.env.ELASTICIO_API_URI)
    .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secret.id}`)
    .basicAuth({
      user: process.env.ELASTICIO_API_USERNAME,
      pass: process.env.ELASTICIO_API_KEY,
    })
    .reply(200, {
      data: {
        id: secret.id,
        type: 'secret',
        attributes: secret,
      },
    });
}

function setNoAuthSecretStub(id) {
  setSecretStub({ type: 'noauth', id });
}

describe('httpRequest action', () => {
  let emitter;
  let currentlyEmitting = false;
  let originalEnv;
  beforeEach(() => {
    originalEnv = process.env;
    process.env = {

      ...process.env,
      ELASTICIO_API_URI: 'http://test.api.e.io',
      ELASTICIO_WORKSPACE_ID: '12344321',
      ELASTICIO_API_USERNAME: 'user',
      ELASTICIO_API_KEY: 'password',
    };

    sinon.restore();
    currentlyEmitting = false;
    emitter = {
      emit: stub().returns(new Promise((resolve) => {
        // eslint-disable-next-line no-unused-expressions
        expect(currentlyEmitting).to.be.false;
        currentlyEmitting = true;
        setTimeout(() => {
          currentlyEmitting = false;
          resolve();
        }, 1);
      })),
      logger,
    };
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  afterEach(() => {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  });

  describe('split result', () => {
    it('should emit each item if splitResult=true', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const msg = {
        body: {
          url: 'http://example.com',
        },
        passthrough: { test: 'test' },
      };
      const cfg = {
        splitResult: true,
        reader: {
          url: 'url',
          method: 'POST',
        },
        secretId: '1234',
      };
      const responseMessage = ['first', 'second', 'third'];
      nock(JsonataTransform.jsonataTransform(msg,
        { expression: cfg.reader.url }, emitter))
        .intercept('/', 'POST')
        .reply((uri, requestBody) => [
          200,
          responseMessage,
        ]);
      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      // eslint-disable-next-line no-unused-expressions
      expect(messagesNewMessageWithBodyStub.calledThrice).to.be.true;
      expect(messagesNewMessageWithBodyStub.args[0][0]).to.deep.include({ body: 'first', statusCode: 200 });
      expect(messagesNewMessageWithBodyStub.args[1][0]).to.deep.include({ body: 'second', statusCode: 200 });
      expect(messagesNewMessageWithBodyStub.args[2][0]).to.deep.include({ body: 'third', statusCode: 200 });
    });
    it('should emit array of item if splitResult=false', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };
      const cfg = {
        splitResult: false,
        reader: {
          url: 'url',
          method: 'POST',
        },
        secretId: 55555,
      };
      const responseMessage = ['first', 'second', 'third'];
      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .post('/')
        .delay(20 + Math.random() * 200)
        .reply((uri, requestBody) => [
          200,
          responseMessage,
        ]);
      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      // eslint-disable-next-line no-unused-expressions
      expect(messagesNewMessageWithBodyStub.calledOnce).to.be.true;
      expect(messagesNewMessageWithBodyStub.args[0][0]).to.deep
        .include({ body: responseMessage, statusCode: 200 });
    });
    it('splitResult=true should be ignored if item is not array', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };
      const cfg = {
        splitResult: true,
        reader: {
          url: 'url',
          method: 'POST',
        },
        secretId: Math.random(),
      };
      const responseMessage = { data: 'not array' };
      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .post('/')
        .delay(20 + Math.random() * 200)
        .reply((uri, requestBody) => [
          200,
          responseMessage,
        ]);
      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      // eslint-disable-next-line no-unused-expressions
      expect(messagesNewMessageWithBodyStub.calledOnce).to.be.true;
      expect(messagesNewMessageWithBodyStub.args[0][0]).to.deep
        .include({ body: responseMessage, statusCode: 200 });
    });
  });

  describe('when all params is correct', () => {
    ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].forEach((method, index) => {
      it(`should properly execute ${method} request`, async () => {
        const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
          .returns(Promise.resolve());
        const msg = {
          body: {
            url: 'http://example.com',
          },
        };

        const cfg = {
          reader: {
            url: 'url',
            method,
          },
          secretId: Math.random(),
        };

        const responseMessage = { message: `hello world ${index}` };

        nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
          .intercept('/', method)
          .delay(20 + Math.random() * 200)
          .reply((uri, requestBody) => [
            200,
            responseMessage,
          ]);

        setNoAuthSecretStub(cfg.secretId);
        await processAction.call(emitter, msg, cfg);
        expect(messagesNewMessageWithBodyStub.args[0][0])
          .to.deep.include({ body: responseMessage, statusCode: 200 });
      });
    });
    ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].forEach((method) => {
      it(`jsonata correctness ${method} test`, async () => {
        const msg = { body: {} };
        const cfg = {
          reader: {
            url: '"http://example.com/bar?foo=" & $moment(1519834345000).format()',
            method,
            headers: [
              {
                key: 'SampleHeader',
                value: '$moment(1519834345000).format()',
              },
            ],
          },
          secretId: Math.random(),
        };

        if (method !== 'GET') {
          cfg.reader.body = {
            raw: '$moment(1519834345000).format()',
            encoding: 'raw',
          };
        }

        // Due to different timezones of developers and production server
        // we can not hardcode expected evaluation result
        const sampleHeaderValue = JsonataTransform.jsonataTransform(messages.newEmptyMessage(), { expression: '$moment(1519834345000).format()' }, emitter);
        expect(sampleHeaderValue.includes('2018-02-28')).to.equal(true);

        nock('http://example.com', {
          reqheaders: {
            SampleHeader: sampleHeaderValue,
          },
        })
          .intercept(`/bar?foo=${sampleHeaderValue}`, method)
          .delay(20 + Math.random() * 200)
          .reply((uri, requestBody) => {
            if (method !== 'GET') {
              expect(sampleHeaderValue.includes('2018-02-28')).to.equal(true);
            }
            return [
              200,
              '{}',
            ];
          });
        setNoAuthSecretStub(cfg.secretId);
        await processAction.call(emitter, msg, cfg);
      });
    });
    it('should pass 1 header properly', (done) => {
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        reader: {
          url: 'url',
          method: 'POST',
          headers: [
            {
              key: 'Content-Type',
              value: '"text/html; charset=UTF-8"',
            },
          ],
        },
        secretId: Math.random(),
      };

      const responseMessage = 'hello world';

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter), {
        reqheaders: {
          'Content-Type': 'text/html; charset=UTF-8',
        },
      })
        .intercept('/', 'POST')
        .delay(20 + Math.random() * 200)
        .reply((uri, requestBody) => {
          done();
          return [
            200,
            responseMessage,
          ];
        });
      setNoAuthSecretStub(cfg.secretId);
      processAction.call(emitter, msg, cfg);
    });
    it('should pass multiple headers properly', (done) => {
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        reader: {
          url: 'url',
          method: 'POST',
          headers: [
            {
              key: 'Accept',
              value: '"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"',
            },
            {
              key: 'Keep-Alive',
              value: '"300"',
            },
            {
              key: 'Connection',
              value: '"keep-alive"',
            },
          ],
        },
        secretId: Math.random(),
      };

      const responseMessage = 'hello world';

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter), {
        reqheaders: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Connection: 'keep-alive',
          'Keep-Alive': '300',
        },
      })
        .intercept('/', 'POST')
        .delay(20 + Math.random() * 200)
        .reply((uri, requestBody) => {
          done();
          return [
            200,
            responseMessage,
          ];
        });

      setNoAuthSecretStub(cfg.secretId);
      processAction.call(emitter, msg, cfg);
    });
    describe('when request body is passed', () => {
      it('should properly pass raw body', (done) => {
        const msg = {
          body: {
            url: 'http://example.com',
          },
        };

        const rawString = '"Lorem ipsum dolor sit amet, consectetur'
          + ' adipiscing elit. Quisque accumsan dui id dolor '
          + 'cursus, nec pharetra metus tincidunt"';

        const cfg = {
          reader: {
            url: 'url',
            method: 'POST',
            body: {
              raw: rawString,
              encoding: 'raw',
            },
          },
          secretId: Math.random(),
        };

        const responseMessage = 'hello world';

        nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
          .post('/', /Lorem\sipsum/gi)
          .delay(20 + Math.random() * 200)
          .reply((uri, requestBody) => {
            done();
            return [
              200,
              responseMessage,
            ];
          });
        setNoAuthSecretStub(cfg.secretId);
        processAction.call(emitter, msg, cfg);
      });
      it('should properly pass formdata body', (done) => {
        const msg = {
          body: {
            url: 'http://example.com',
            world: 'world',
          },
        };

        const cfg = {
          reader: {
            url: 'url',
            method: 'POST',
            body: {
              formData: [
                {
                  key: 'foo',
                  value: '"bar"',
                },
                {
                  key: 'baz',
                  value: '"qwe"',
                },
                {
                  key: 'hello',
                  value: '"world"',
                },
              ],
              contentType: 'multipart/form-data',
            },
            headers: [],
          },
          secretId: '1234',
        };

        const responseMessage = 'hello world';

        nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
          .post('/', (body) => body.replace(/[\n\r]/g, '').match(/foo.+bar.+baz.+qwe.+hello.+world/))
          .delay(20 + Math.random() * 200)
          .reply((uri, requestBody) => {
            done();
            return [
              200,
              responseMessage,
            ];
          });
        setNoAuthSecretStub(cfg.secretId);
        processAction.call(emitter, msg, cfg);
      });
    });
  });
  describe('connection error', () => {
    it('connection error && dontThrowErrorFlg false', async () => {
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        dontThrowErrorFlg: false,
        reader: {
          url: 'url',
          method,
        },
        secretId: '1234',
      };

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .intercept('/', method)
        .delay(20 + Math.random() * 200)
        .replyWithError('something awful happened');
      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg).catch((e) => {
        expect(e.message).to.be.eql('Error: something awful happened');
      });
    });

    it('connection error && dontThrowErrorFlg true', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        dontThrowErrorFlg: true,
        enableRebound: true,
        reader: {
          url: 'url',
          method,
        },
        secretId: '1234',
      };

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .intercept('/', method)
        .delay(20 + Math.random() * 200)
        .replyWithError('something awful happened');
      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg).catch((e) => {
        expect(e.message).to.be.eql('Error: something awful happened');
        expect(emitter.emit.withArgs('rebound').callCount).to.be.equal(1);
      });
    });

    it('connection error && enableRebound true', async () => {
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        enableRebound: true,
        reader: {
          url: 'url',
          method,
        },
        secretId: '1234',
      };

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .intercept('/', method)
        .delay(20 + Math.random() * 200)
        .reply(408, 'Error');

      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      expect(emitter.emit.withArgs('rebound').callCount).to.be.equal(1);
      expect(emitter.emit.withArgs('rebound').args[0][1]).to.be.equal(
        'Code: 408 Message: HTTP error Body: Error',
      );
    });
  });

  describe('when some args are wrong', () => {
    it('should throw error if cfg.reader.method is absent', async () => {
      const msg = {
        body: {
          url: 'example.com',
        },
      };

      const cfg = {
        reader: {
          url: 'url',
        },
        secretId: '1234',
      };

      setNoAuthSecretStub(cfg.secretId);
      try {
        await processAction.call(emitter, msg, cfg);
      } catch (err) {
        expect(err.message).equal('Method is required');
      }
    });
    it('should throw error if cfg.reader.url is absent', async () => {
      const msg = {
        body: {
          url: 'example.com',
        },
      };

      const cfg = {
        reader: {
          method: 'GET',
        },
        secretId: '1234',
      };

      setNoAuthSecretStub(cfg.secretId);
      try {
        await processAction.call(emitter, msg, cfg);
      } catch (err) {
        expect(err.message).equal('URL is required');
      }
    });
    it('should throw error if cfg.reader.method is wrong', async () => {
      const msg = {
        body: {
          url: 'example.com',
        },
      };

      const cfg = {
        reader: {
          url: 'url',
          method: 'GETT',
        },
        secretId: '1234',
      };
      setNoAuthSecretStub(cfg.secretId);
      try {
        await processAction.call(emitter, msg, cfg);
      } catch (err) {
        expect(err.message).equal(
          `Method "${cfg.reader.method}" isn't one of the: DELETE,GET,PATCH,POST,PUT.`,
        );
      }
    });
  });

  describe('Non-JSON responses', () => {
    it('No response body && dontThrowErrorFlg true', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        dontThrowErrorFlg: true,
        reader: {
          url: 'url',
          method,
        },
        secretId: '1234',
      };

      const responseMessage = '';

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .intercept('/', method)
        .delay(20 + Math.random() * 200)
        .reply(204, responseMessage);

      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);

      // eslint-disable-next-line no-unused-expressions
      expect(messagesNewMessageWithBodyStub.args[0][0]).to.deep
        .include({ statusCode: 204, body: undefined });
    });
    it('No response body && dontThrowErrorFlg false', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        dontThrowErrorFlg: false,
        reader: {
          url: 'url',
          method,
        },
        secretId: '1234',
      };

      const responseMessage = '';

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .intercept('/', method)
        .delay(20 + Math.random() * 200)
        .reply(204, responseMessage);

      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);

      expect(messagesNewMessageWithBodyStub.lastCall.args[0])
        .to.deep.include({
          headers: {},
          body: undefined,
          statusCode: 204,
        });
    });
    it('Valid XML Response && dontThrowErrorFlg true', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        dontThrowErrorFlg: true,
        reader: {
          url: 'url',
          method,
        },
        secretId: '1234',
      };

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .intercept('/', method)
        .delay(20 + Math.random() * 200)
        .reply(200, '<xml>foo</xml>', {
          'Content-Type': 'application/xml',
        });

      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);

      expect(messagesNewMessageWithBodyStub.lastCall.args[0])
        .to.deep.equal(
          {
            headers: { 'content-type': 'application/xml' },
            body: { xml: 'foo' },
            statusCode: 200,
            statusMessage: null,
          },
        );
    });
    it('Valid XML Response && dontThrowErrorFlg false', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        dontThrowErrorFlg: false,
        reader: {
          url: 'url',
          method,
        },
        secretId: '1234',
      };

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .intercept('/', method)
        .delay(20 + Math.random() * 200)
        .reply(200, '<xml>foo</xml>', {
          'Content-Type': 'application/xml',
        });
      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);

      expect(messagesNewMessageWithBodyStub.lastCall.args[0])
        .to.deep.include({
          body: { xml: 'foo' },
          headers: { 'content-type': 'application/xml' },
          statusCode: 200,
        });
    });
    it('Invalid XML Response', async () => {
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        reader: {
          url: 'url',
          method,
        },
        secretId: '1234',
      };

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .intercept('/', method)
        .delay(20 + Math.random() * 200)
        .reply(200, '<xml>foo</xmlasdf>', {
          'Content-Type': 'application/xml',
        });

      setNoAuthSecretStub(cfg.secretId);
      try {
        await processAction.call(emitter, msg, cfg);
        throw new Error('This line should never be called because await above should throw an error');
      } catch (err) {
        // all good
      }
    });
  });

  describe('Some text response without any content type', () => {
    it('No response body', async () => {
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        reader: {
          url: 'url',
          method,
        },
        secretId: '1234',
      };

      const responseMessage = 'boom!';

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .intercept('/', method)
        .delay(20 + Math.random() * 200)
        .reply((uri, requestBody) => [
          200,
          responseMessage,
        ]);
      setNoAuthSecretStub(cfg.secretId);
      try {
        await processAction.call(emitter, msg, cfg);
        throw new Error('This line should never be called because await above should throw an error');
      } catch (err) {
        // all good
      }
    });
    it('JSON string without content-type  && dontThrowErrorFlg true', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        dontThrowErrorFlg: true,
        reader: {
          url: 'url',
          method,
        },
        secretId: '1234',
      };

      const responseMessage = '{"id":"1", "name":"John", "surname":"Malkovich"}';

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .intercept('/', method)
        .delay(20 + Math.random() * 200)
        .reply((uri, requestBody) => [
          200,
          responseMessage,
        ]);
      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      expect(messagesNewMessageWithBodyStub.lastCall.args[0]).to.deep.eql({
        headers: {},
        body: {
          id: '1',
          name: 'John',
          surname: 'Malkovich',
        },
        statusCode: 200,
        statusMessage: null,
      });
    });
    it('JSON string without content-type  && dontThrowErrorFlg false', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        dontThrowErrorFlg: false,
        reader: {
          url: 'url',
          method,
        },
        auth: {},
        secretId: '1234',
      };

      const responseMessage = '{"id":"1", "name":"John", "surname":"Malkovich"}';

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .intercept('/', method)
        .delay(20 + Math.random() * 200)
        .reply((uri, requestBody) => [
          200,
          responseMessage,
        ]);
      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      expect(messagesNewMessageWithBodyStub.lastCall.args[0]).to.deep.eql({
        body:
        {
          id: '1',
          name: 'John',
          surname: 'Malkovich',
        },
        statusCode: 200,
        headers: {},
        statusMessage: null,
      });
    });
    it('XML string without content-type   && dontThrowErrorFlg false', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        dontThrowErrorFlg: false,
        reader: {
          url: 'url',
          method,
        },
        secretId: '1234',
      };

      const responseMessage = '<first>1</first><second>2</second>';

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .intercept('/', method)
        .delay(20 + Math.random() * 200)
        .reply((uri, requestBody) => [
          200,
          responseMessage,
        ]);
      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      expect(messagesNewMessageWithBodyStub.lastCall.args[0]).to.eql({
        body: responseMessage,
        statusCode: 200,
        statusMessage: null,
        headers: {},
      });
    });
    it('XML string without content-type   && dontThrowErrorFlg true', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com',
        },
      };

      const cfg = {
        dontThrowErrorFlg: true,
        reader: {
          url: 'url',
          method,
        },
        secretId: '1234',
      };

      const responseMessage = '<first>1</first><second>2</second>';

      nock(JsonataTransform.jsonataTransform(msg, { expression: cfg.reader.url }, emitter))
        .intercept('/', method)
        .delay(20 + Math.random() * 200)
        .reply((uri, requestBody) => [
          200,
          responseMessage,
        ]);
      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      expect(messagesNewMessageWithBodyStub.lastCall.args[0]).to.deep.equal({
        body: responseMessage,
        headers: {},
        statusCode: 200,
        statusMessage: null,
      });
    });
  });

  describe('redirection', () => {
    it('redirect request true && dontThrowErrorFlg true', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'GET';
      const msg = {
        body: {
          url: 'http://example.com/YourAccount',
        },
      };

      const cfg = {
        reader: {
          url: 'url',
          method,
        },
        followRedirect: 'followRedirects',
        dontThrowErrorFlg: true,
        secretId: '1234',
      };

      nock('http://example.com')
        .get('/YourAccount')
        .reply(302, '{"state":"before redirection"}', {
          Location: 'http://example.com/Login',
        })
        .get('/Login')
        .reply(200, '{"state": "after redirection"}', { 'Content-Type': 'application/json' });

      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      expect(messagesNewMessageWithBodyStub.lastCall.args[0]).to.deep.equal({
        body: {
          state: 'after redirection',
        },
        headers: {
          'content-type': 'application/json',
        },
        statusCode: 200,
        statusMessage: null,
      });
    });
    it('redirect request true && dontThrowErrorFlg false', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'GET';
      const msg = {
        body: {
          url: 'http://example.com/YourAccount',
        },
      };

      const cfg = {
        reader: {
          url: 'url',
          method,
        },
        followRedirect: 'followRedirects',
        secretId: '1234',
      };

      nock('http://example.com')
        .get('/YourAccount')
        .reply(302, '{"state":"before redirection"}', {
          Location: 'http://example.com/Login',
        })
        .get('/Login')
        .reply(200, '{"state": "after redirection"}', { 'Content-Type': 'application/json' });

      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      expect(messagesNewMessageWithBodyStub.lastCall.args[0])
        .to
        .deep
        .include({
          body: { state: 'after redirection' },
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
        });
    });
    it('redirect request false && dontThrowErrorFlg true', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'GET';
      const msg = {
        body: {
          url: 'http://example.com/YourAccount',
        },
      };

      const cfg = {
        reader: {
          url: 'url',
          method,
        },
        dontThrowErrorFlg: true,
        followRedirect: 'doNotFollowRedirects',
        secretId: '1234',
      };

      nock('http://example.com')
        .get('/YourAccount')
        .reply(302, '{"state":"before redirection"}', {
          Location: 'http://example.com/Login',
          'Content-Type': 'application/json',
        })
        .get('/Login')
        .reply(200, '{"state": "after redirection"}', { 'Content-Type': 'application/json' });

      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      expect(messagesNewMessageWithBodyStub.lastCall.args[0]).to.deep.equal({
        headers:
          {
            location: 'http://example.com/Login',
            'content-type': 'application/json',
          },
        body: { state: 'before redirection' },
        statusCode: 302,
        statusMessage: null,
      });
    });
    it('redirect request false && dontThrowErrorFlg false', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'GET';
      const msg = {
        body: {
          url: 'http://example.com/YourAccount',
        },
      };

      const cfg = {
        reader: {
          url: 'url',
          method,
        },
        followRedirect: 'doNotFollowRedirects',
        secretId: '1234',
      };

      nock('http://example.com')
        .get('/YourAccount')
        .reply(302, '{"state":"before redirection"}', {
          Location: 'http://example.com/Login',
          'Content-Type': 'application/json',
        })
        .get('/Login')
        .reply(200, '{"state": "after redirection"}', { 'Content-Type': 'application/json' });

      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      expect(messagesNewMessageWithBodyStub.lastCall.args[0])
        .to
        .deep
        .include({
          body: { state: 'before redirection' },
          statusCode: 302,
          headers: { location: 'http://example.com/Login', 'content-type': 'application/json' },
        });
    });
    it('redirect request false POST && dontThrowErrorFlg false', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com/YourAccount',
        },
      };

      const cfg = {
        reader: {
          url: 'url',
          method,
        },
        followRedirect: 'doNotFollowRedirects',
        secretId: '1234',
      };

      nock('http://example.com')
        .post('/YourAccount')
        .reply(302, '{"state":"before redirection"}', {
          Location: 'http://example.com/Login',
          'Content-Type': 'application/json',
        })
        .get('/Login')
        .reply(200, '{"state": "after redirection"}', { 'content-type': 'application/json' });

      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      expect(messagesNewMessageWithBodyStub.lastCall.args[0])
        .to
        .deep
        .include({
          body: { state: 'before redirection' },
          statusCode: 302,
          headers: { location: 'http://example.com/Login', 'content-type': 'application/json' },
        });
    });
    it('redirect request false POST && dontThrowErrorFlg false', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const method = 'POST';
      const msg = {
        body: {
          url: 'http://example.com/YourAccount',
        },
      };

      const cfg = {
        reader: {
          url: 'url',
          method,
        },
        followRedirect: 'followRedirects',
        secretId: '1234',
      };

      nock('http://example.com')
        .post('/YourAccount')
        .reply(302, '{"state":"before redirection"}', {
          Location: 'http://example.com/Login',
          'Content-Type': 'application/json',
        })
        .get('/Login')
        .reply(200, '{"state": "after redirection"}', { 'Content-Type': 'application/json' });

      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      expect(messagesNewMessageWithBodyStub.lastCall.args[0])
        .to
        .deep
        .include({
          body: { state: 'after redirection' },
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
        });
    });
  });
  describe('attachments', () => {
    it('action message with inbound attachments', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const inputMsg = {
        body: {
          url: 'http://qwre.com',
          world: 'world',
        },
        attachments: {
          '1.csv': {
            'content-type': 'text/csv',
            size: '45889',
            url: 'http://insight.dev.schoolwires.com/HelpAssets/C2Assets/C2Files/C2ImportCalEventSample.csv',
          },

          '2.csv': {
            'content-type': 'text/csv',
            size: '45889',
            url: 'http://insight.dev.schoolwires.com/HelpAssets/C2Assets/C2Files/C2ImportCalEventSample.csv',
          },

          '3.csv': {
            'content-type': 'text/csv',
            size: '45889',
            url: 'http://insight.dev.schoolwires.com/HelpAssets/C2Assets/C2Files/C2ImportCalEventSample.csv',
          },
        },
      };

      const rawString = 'Lorem ipsum dolor sit amet, consectetur'
        + ' adipiscing elit. Quisque accumsan dui id dolor '
        + 'cursus, nec pharetra metus tincidunt';

      const cfg = {
        reader: {
          url: 'url',
          method: 'POST',
          body: {
            formData: [
              {
                key: 'foo',
                value: '"bar"',
              },
              {
                key: 'baz',
                value: '"qwe"',
              },
              {
                key: 'hello',
                value: '"world"',
              },
            ],
            contentType: 'multipart/form-data',
          },
          headers: [],
        },
        secretId: '1234',
      };

      nock('http://qwre.com')
        .post('/', (body) => {
          expect(body).to.contain('Start Date');
          return body.replace(/[\n\r]/g, '').match(/foo.+bar.+baz.+qwe.+hello.+world/);
        })
        .delay(20 + Math.random() * 200)
        .reply((uri, requestBody) => [
          200,
          rawString,
        ]);
      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, inputMsg, cfg);
      expect(messagesNewMessageWithBodyStub.lastCall.args[0]).to
        .include({ body: rawString, statusCode: 200 });
    });

    it('action message with outbound attachment', async () => {
      const inputMsg = {
        body: {},
      };

      const fileContents = fs.readFileSync('./logo.png');

      const cfg = {
        reader: {
          url: '"https://example.com/image.png"',
          method: 'GET',
          headers: [],
        },
        auth: {},
      };

      sinon.stub(client.resources.storage, 'createSignedUrl').returns(Promise.resolve({
        get_url: 'http://example.com/getUrl',
        put_url: 'http://example.com/putUrl',
      }));

      nock('http://example.com')
        .put('/putUrl')
        .reply((uri, requestBody) => {
          expect(requestBody).to.deep.equal(fileContents.toString('hex'));
          return [
            200,
          ];
        });

      nock('https://example.com')
        .get('/image.png')
        .reply((uri, requestBody) => [
          200,
          fileContents,
          {
            'Content-Type': 'image/png',
            'content-length': fileContents.length,
          },
        ]);

      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, inputMsg, cfg);
      expect(emitter.emit.args[0][1].body).to.deep.eql({
        statusCode: 200,
        statusMessage: null,
        headers: { 'content-type': 'image/png', 'content-length': '22421' },
        attachments: {
          'content-type': 'image/png',
          size: '22421',
          sourceUrl: 'https://example.com/image.png',
          url: 'http://example.com/getUrl',
        },
      });
    });
  });

  describe('404 not found', () => {
    it('404 not found && dontThrowErrorFlg true', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      nock('http://example.com')
        .get('/YourAccount')
        .delay(20 + Math.random() * 200)
        .reply(404);
      const method = 'GET';
      const msg = {
        body: {
          url: 'http://example.com/YourAccount',
        },
      };

      const cfg = {
        reader: {
          url: 'url',
          method,
        },
        followRedirect: 'followRedirects',
        dontThrowErrorFlg: true,
        secretId: '1234',
      };

      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      expect(messagesNewMessageWithBodyStub.lastCall.args[0].statusCode).to.eql(404);
      // TODO: should be 'Not Found' but nock doesn't allow statusMessage to be mocked https://github.com/nock/nock/issues/469
      expect(messagesNewMessageWithBodyStub.lastCall.args[0].statusMessage).to.eql('HTTP error.');
    });
    it('404 not found && dontThrowErrorFlg false', async () => {
      nock('http://example.com')
        .get('/YourAccount')
        .delay(20 + Math.random() * 200)
        .reply(404);

      const method = 'GET';
      const msg = {
        body: {
          url: 'http://example.com/YourAccount',
        },
      };

      const cfg = {
        reader: {
          url: 'url',
          method,
        },
        followRedirect: 'followRedirects',
        dontThrowErrorFlg: false,
        secretId: '1234',
      };

      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      expect(emitter.emit.callCount).to.equal(2);
      expect(emitter.emit.args[0][0]).to.equal('error');
      expect(emitter.emit.args[1][0]).to.equal('end');
    });
  });

  describe('delay between calls', () => {
    it('should wait delayBetweenCalls', async () => {
      const messagesNewMessageWithBodyStub = stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());
      const msg = {
        body: {
          url: 'http://example.com',
        },
        passthrough: { test: 'test' },
      };
      const cfg = {
        splitResult: true,
        reader: {
          url: 'url',
          method: 'POST',
        },
        secretId: '1234',
        delay: '20',
        callCount: '4',
      };
      const responseMessage = ['first', 'second', 'third'];
      nock(JsonataTransform.jsonataTransform(msg,
        { expression: cfg.reader.url }, emitter))
        .intercept('/', 'POST')
        .reply((uri, requestBody) => [
          200,
          responseMessage,
        ]);
      setNoAuthSecretStub(cfg.secretId);
      await processAction.call(emitter, msg, cfg);
      // eslint-disable-next-line no-unused-expressions
      expect(messagesNewMessageWithBodyStub.calledThrice).to.be.true;
      expect(messagesNewMessageWithBodyStub.args[0][0].body).to.be.eql('first');
      expect(messagesNewMessageWithBodyStub.args[1][0].body).to.be.eql('second');
      expect(messagesNewMessageWithBodyStub.args[2][0].body).to.be.eql('third');
    });
  });

  describe('timeout configuration', () => {
    // Temporarily skip test as https://httpstat.us/200 is temporarily down
    it.skip('should fail on small timeout', async () => {
      const msg = {
        body: {
          url: 'https://httpstat.us/200?sleep=5000',
        },
        passthrough: { test: 'test' },
      };
      const cfg = {
        splitResult: true,
        reader: {
          url: 'url',
          method: 'GET',
        },
        auth: {},
        requestTimeoutPeriod: '1000',
      };

      // Workaround for https://github.com/Readify/httpstatus/issues/79
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

      await processAction.call(emitter, msg, cfg);
      expect(emitter.emit.getCall(0).args[0]).to.be.equals('error');
      expect(emitter.emit.getCall(0).args[1].message).to.be.equals(`Timeout error! Waiting for response more than ${cfg.requestTimeoutPeriod} ms`);
    });
  });
});
