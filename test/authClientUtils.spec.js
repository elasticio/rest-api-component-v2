const { expect } = require('chai');
const nock = require('nock');
const logger = require('@elastic.io/component-logger')();
const { getSecret, refreshToken } = require('../lib/authClientUtils');

describe('authClientUtils test', () => {
  process.env.ELASTICIO_API_URI = 'https://app.example.io';
  process.env.ELASTICIO_API_USERNAME = 'user';
  process.env.ELASTICIO_API_KEY = 'apiKey';
  process.env.ELASTICIO_WORKSPACE_ID = 'workspaceId';
  const secret = {
    data: {
      attributes: {
        credentials: {
          access_token: 'accessToken',
        },
      },
    },
  };
  const secretId = 'secretId';
  afterEach(() => {
    nock.cleanAll();
  });
  it('should getSecret', async () => {
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secretId}`)
      .reply(200, secret);
    const result = await getSecret({ logger }, secretId);
    expect(result).to.eql(secret.data.attributes);
  });
  it('should refreshToken', async () => {
    nock(process.env.ELASTICIO_API_URI)
      .post(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secretId}/refresh`)
      .reply(200, secret);
    const result = await refreshToken({ logger }, secretId);
    expect(result).to.eql(secret.data.attributes.credentials.access_token);
  });
});
