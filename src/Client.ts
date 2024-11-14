/* eslint-disable guard-for-in, no-param-reassign */
import axios, { AxiosRequestConfig, AxiosResponse, CreateAxiosDefaults, AxiosInstance } from 'axios';
import FormData, { AppendOptions } from 'form-data';
import * as commons from '@elastic.io/component-commons-library';
import https from 'https';
import {
  getSecret,
  refreshSecret,
  Cfg,
  Secret,
  checkNumField,
  getAttachmentStream
} from './utils';

const DEFAULT_TIME_OUT = 60 * 1000; // 1min
const MAX_TIME_OUT = 19 * 60 * 1000; // 19min
const MAX_REDIRECTS = 10;
const MAX_CONTENT_LENGTH = process.env.MAX_CONTENT_LENGTH ? Number(process.env.MAX_CONTENT_LENGTH) : 20 * 1024 * 1024; // 20MB
const MAX_FILE_LENGTH = process.env.MAX_FILE_LENGTH ? Number(process.env.MAX_FILE_LENGTH) : 100 * 1024 * 1024; // 100MB
const MAX_RETRIES = 10;
const MAX_DELAY = 19 * 60 * 1000; // 19min

export default class Client {
  private logger: any;

  private cfg: Cfg;

  private secret: Secret;

  ax: AxiosInstance;

  private lastRequest: number;

  private context: any;

  private msg: any;

  constructor(context, cfg: Cfg, msg?) {
    this.logger = context.logger;
    this.context = context;
    this.msg = msg;
    this.cfg = cfg;
    this.createAxiosInstance();
  }

  createAxiosInstance() {
    const {
      requestTimeoutPeriod,
      noStrictSSL,
      maxRedirects,
      maxContentLength,
      maxBodyLength,
      downloadAsAttachment,
      responseEncoding
    } = this.cfg;

    const maxLength = downloadAsAttachment ? MAX_FILE_LENGTH : MAX_CONTENT_LENGTH;

    checkNumField('Request timeout', requestTimeoutPeriod, 1, MAX_TIME_OUT);
    checkNumField('Maximum redirects', maxRedirects, 0, MAX_REDIRECTS);
    checkNumField('Request size limit', maxBodyLength, 1, Infinity);
    checkNumField('Response size limit', maxContentLength, 1, maxLength);
    this.parseCustomErrorCodesRange();

    const axiosConfig: CreateAxiosDefaults = {};
    axiosConfig.timeout = requestTimeoutPeriod ? Number(requestTimeoutPeriod) : DEFAULT_TIME_OUT;
    axiosConfig.maxContentLength = maxContentLength ? Number(maxContentLength) : maxLength;
    if (downloadAsAttachment) axiosConfig.responseType = 'stream';

    if (maxRedirects === '0') {
      axiosConfig.maxRedirects = 0;
    } else if (maxRedirects) {
      axiosConfig.maxRedirects = Number(maxRedirects);
    }

    if (noStrictSSL) {
      axiosConfig.httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });
    }

    if (responseEncoding) axiosConfig.responseEncoding = responseEncoding;

    this.ax = axios.create(axiosConfig);
  }

  setLogger(logger) { this.logger = logger; }

  setCfgAndMsg(cfg, msg) {
    this.cfg = cfg;
    this.msg = msg;
  }

  async apiRequest(): Promise<AxiosResponse | 'rebound'> {
    if (!this.secret) {
      this.logger.debug('Secret not found, going to fetch new one');
      await this.getNewSecret();
      this.logger.debug('Secret got successfully');
    }

    const { errorPolicy, maxRetries, delay } = this.cfg;
    checkNumField('Maximum retries', maxRetries, 0, MAX_RETRIES);
    checkNumField('Delay in ms', delay, 0, MAX_DELAY);

    if (this.lastRequest && delay) {
      const requestAfter = this.lastRequest + Number(delay);
      if (Date.now() < requestAfter) {
        const delayMs = requestAfter - Date.now();
        this.logger.warn(`This request will be delayed on ${delayMs}ms`);
        await commons.sleep(delayMs);
      }
    }

    const maximumRetries = maxRetries ? Number(maxRetries) : MAX_RETRIES;

    let response;
    let errMsg;
    let currentRetry = 0;
    do {
      this.lastRequest = Date.now();
      try {
        const opts = await this.getOptions();
        this.addAuthentication(opts);
        response = await this.ax(opts);
        return response;
      } catch (err) {
        errMsg = err.response ? commons.getErrMsg(err.response) : `Got error "${err.message}"${err.code ? ` (code - ${err.code})` : ''}`;
        this.logger.error(errMsg);
        if (err.response?.status === 401 && this.secret.type === 'oauth2') {
          this.logger.debug('Token invalid, going to fetch new one');
          const currentToken = this.secret.credentials.access_token;
          await this.getNewSecret();
          if (currentToken === this.secret.credentials.access_token) {
            this.logger.debug('Token not changed, going to force refresh');
            await this.refreshAndGetNewSecret();
          }
          this.logger.debug('Trying to use new token');
        } else if (this.checkIfErrorCodeInErrorRange(err.response?.status) || err.code === 'ECONNABORTED') {
          if (errorPolicy === 'throwError') throw new Error(errMsg);
          if (errorPolicy === 'emit') return err.response;
          if (errorPolicy === 'rebound') return 'rebound';
          const retryAfter = err.response?.headers?.['retry-after'] || 2 ** currentRetry;
          this.logger.error(`Going to retry after ${retryAfter}sec (${currentRetry + 1} of ${maximumRetries})`);
          await commons.sleep(retryAfter * 1000);
        } else {
          throw err;
        }
      }
      currentRetry++;
    } while (currentRetry < maximumRetries);
    throw new Error(errMsg);
  }

  checkIfErrorCodeInErrorRange(code?: number): boolean {
    if (!code) return false;
    if (!this.cfg.errorCodes) return [408, 423, 429].includes(code) || code >= 500;
    const customErrorRange = this.parseCustomErrorCodesRange();
    return customErrorRange.includes(code);
  }

  parseCustomErrorCodesRange(): number[] {
    const result = [];
    const { errorCodes } = this.cfg;
    if (!errorCodes) return result;
    for (const codeOrRange of errorCodes.split(',').map((_codeOrRange) => _codeOrRange.trim())) {
      if (/\D+/.test(codeOrRange)) {
        const range = codeOrRange.split('-');
        if (range.length !== 2) throw new Error(`Invalid code or range - "${codeOrRange}" in "Error Codes for retry" field`);
        range.forEach((code) => { if (commons.isNumberNaN(code)) throw new Error(`Invalid code "${code}" in range - "${codeOrRange}" in "Error Codes for retry" field`); });
        const [start, end] = range.map(Number);
        if (start > end) throw new Error(`Invalid range - "${codeOrRange}", first code should be less than second in "Error Codes for retry" field`);
        for (let i = start; i <= end; i++) {
          result.push(i);
        }
      } else {
        result.push(Number(codeOrRange));
      }
    }
    return result;
  }

  async getOptions(): Promise<AxiosRequestConfig<any>> {
    const { url, body, headers, method } = this.cfg.reader;
    const { uploadFile } = this.cfg;
    const transform = (expression) => commons.JsonataTransform.jsonataTransform(this.msg, { expression }, this.context);

    const opts: AxiosRequestConfig = {
      method,
      url: transform(url),
      headers: {}
    };

    if (headers && headers.length > 0) {
      for (const header of headers) {
        opts.headers[header.key] = transform(header.value);
      }
    }
    if (!body) return opts;

    if (body.contentType.toLowerCase() === 'application/x-www-form-urlencoded') {
      const { urlencoded } = body;
      if (urlencoded && urlencoded.length > 0) {
        const params = new URLSearchParams();
        for (const pair of urlencoded) {
          const parsedValue = transform(pair.value);
          params.append(pair.key, typeof parsedValue === 'object' ? JSON.stringify(parsedValue) : parsedValue);
        }
        opts.params = params;
      }
    } else if (body.contentType.toLowerCase() === 'multipart/form-data') {
      const { formData } = body;
      if (formData && formData.length > 0) {
        const form = new FormData();
        for (const pair of formData) {
          const transformedValue = transform(pair.value);
          let valueToSend = transformedValue;
          const { url: urlToFile, knownLength, filename } = transformedValue;
          if (uploadFile && urlToFile) {
            const formDataOpts: AppendOptions = {};
            if (urlToFile) {
              const { data, headers: fileStreamHeaders } = await getAttachmentStream(urlToFile, this.msg.id, this.logger);
              formDataOpts.knownLength = knownLength || fileStreamHeaders['content-length'];
              valueToSend = data;
            }
            if (filename) formDataOpts.filename = filename;
            form.append(pair.key, valueToSend, formDataOpts);
          } else {
            if (typeof valueToSend !== 'string') valueToSend = JSON.stringify(valueToSend);
            form.append(pair.key, valueToSend);
          }
        }
        opts.data = form;
        opts.headers = {
          ...opts.headers,
          ...form.getHeaders()
        };
        if (form.hasKnownLength()) opts.headers['content-length'] = form.getLengthSync();
      }
    } else if (body.contentType.toLowerCase() === 'application/octet-stream' && uploadFile) {
      const urlToFile = transform(body.raw);
      const { data } = await getAttachmentStream(urlToFile, this.msg.id, this.logger);
      opts.data = data;
    } else if (body.raw) {
      opts.data = transform(body.raw);
    }

    return opts;
  }

  async getNewSecret() {
    if (this.cfg.secretId) {
      this.logger.debug('Fetching credentials by secretId');
      this.secret = await getSecret.call(this, this.cfg.secretId);
    } else {
      throw new Error('Can\'t find credentials in incoming configuration');
    }
  }

  async refreshAndGetNewSecret() {
    this.secret = await refreshSecret.call(this, this.cfg.secretId);
  }

  addAuthentication(opts: AxiosRequestConfig) {
    const secretType = this.secret.type;
    if (secretType === 'basic') {
      const { username, password } = this.secret.credentials;
      if (!username || !password) throw new Error('"Username" or "Password" is missing in the credentials section');
      opts.auth = {
        username,
        password,
      };
    }
    if (secretType === 'api_key') {
      const { headerName, headerValue } = this.secret.credentials;
      if (!headerName || !headerValue) throw new Error('"Header Name" or "Header Value" is missing in the credentials section');
      opts.headers ||= {};
      opts.headers[headerName] = headerValue;
    }
    if (secretType === 'oauth2') {
      opts.headers ||= {};
      opts.headers.Authorization = `Bearer ${this.secret.credentials.access_token}`;
    }
  }
}
