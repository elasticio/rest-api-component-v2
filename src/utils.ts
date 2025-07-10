import * as commons from '@elastic.io/component-commons-library';
import { version as commonsLibraryVersion, dependencies } from '@elastic.io/component-commons-library/package.json';
import packageJson from '../package.json';
import compJson from '../component.json';

const auth = {
  username: process.env.ELASTICIO_API_USERNAME,
  password: process.env.ELASTICIO_API_KEY,
};

const headers = { 'User-Agent': `${compJson.title}/${compJson.version} component-commons-library/${commonsLibraryVersion} axios/${dependencies.axios}` };
const secretsUrl = `${process.env.ELASTICIO_API_URI}/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/`;

export async function getSecret(secretId: string) {
  const response: any = await commons.axiosReqWithRetryOnServerError.call(this, {
    method: 'GET',
    url: `${secretsUrl}${secretId}`,
    auth,
    headers
  });
  return response.data.data.attributes;
}

export async function refreshSecret(secretId: string) {
  const response: any = await commons.axiosReqWithRetryOnServerError.call(this, {
    method: 'POST',
    url: `${secretsUrl}${secretId}/refresh`,
    auth,
    headers
  });
  return response.data.data.attributes;
}

export const getUserAgent = () => {
  const { name: compName } = packageJson;
  const { version: compVersion } = compJson;
  const maesterClientVersion = packageJson.dependencies['@elastic.io/maester-client'];
  return `${compName}/${compVersion} maester-client/${maesterClientVersion}`;
};

export const checkNumField = (name, value, minValue, maxValue) => {
  if (value && (commons.isNumberNaN(value) || Number(value) < minValue || Number(value) > maxValue)) {
    throw new Error(`"${name}" must be valid number between ${minValue} and ${maxValue}`);
  }
};

export const isMaesterUrl = (url: string) => /=maester$/.test(url);

export const getFileStream = async (url, logger) => commons.axiosReqWithRetryOnServerError.call({ logger, cfg: {} }, {
  method: 'GET',
  url,
  responseType: 'stream'
});

export const getAttachmentStream = async (url, msgId, logger) => {
  const attachmentProcessor = new commons.AttachmentProcessor(getUserAgent(), msgId);
  let response;
  try {
    if (isMaesterUrl(url)) {
      response = await attachmentProcessor.getAttachment(url, 'stream');
    } else {
      response = await getFileStream(url, logger);
    }
    return response;
  } catch (err) {
    throw new Error(`Can't extract file from provided url: ${url}, error: ${err.message}`);
  }
};

export interface Cfg {
  reader: Reader
  maxRetries?: string
  errorPolicy?: 'byComponent' | 'rebound' | 'throwError' | 'emit'
  noStrictSSL?: boolean
  maxRedirects?: string
  maxContentLength?: string
  maxBodyLength?: string
  errorCodes?: string
  ignoreErrorCodes?: string
  responseEncoding?: string
  downloadAsAttachment?: boolean
  uploadFile?: boolean
  delay?: string
  requestTimeoutPeriod?: string
  secretId: string
  credentials: CredentialsOAuth | CredentialsNoAuth | CredentialsApiKey | CredentialsBasic
}

export interface Reader {
  method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE'
  url: string
  body?: Body
  headers?: Header[]
}

export interface Body {
  raw?: string
  formData?: FormData[]
  urlencoded?: Urlencoded[]
  contentType?: string
}

export interface FormData {
  key: string
  value: string | FormDataUploadValue
}

export interface FormDataUploadValue {
  url: string
  knownLength?: number
  filename?: string
}

export interface Urlencoded {
  key: string
  value: string
}

export interface Header {
  key: string
  value: string
}

export interface CredentialsOAuth {
  access_token: string
  refresh_token: string
  expires_in: number
  fields: Fields
  undefined_params: any
}

export interface CredentialsBasic {
  username: string
  password: string
  fields: Fields
}

export interface CredentialsNoAuth {
  fields: Fields
}

export interface CredentialsApiKey {
  headerName: string
  headerValue: string
  fields: Fields
}

export interface SecretBase {
  name: string;
  state: string;
  type: 'basic' | 'oauth2' | 'noauth' | 'api_key';
}

export interface SecretBasic extends SecretBase { type: 'basic'; credentials: CredentialsBasic; }
export interface SecretOAuth extends SecretBase { type: 'oauth2'; credentials: CredentialsOAuth; }
export interface SecretNoAuth extends SecretBase { type: 'noauth'; credentials: CredentialsNoAuth; }
export interface SecretApiKey extends SecretBase { type: 'api_key'; credentials: CredentialsApiKey; }
export type Secret = SecretBasic | SecretOAuth | SecretNoAuth | SecretApiKey;

export interface Fields { }
