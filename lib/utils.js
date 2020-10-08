/* eslint-disable max-len,no-shadow,no-param-reassign,no-underscore-dangle,no-use-before-define,consistent-return,arrow-parens */

const { JsonataTransform } = require('@elastic.io/component-commons-library');
const request = require('request-promise');
const { messages } = require('elasticio-node');
const xml2js = require('xml2js-es6-promise');
const uuidv1 = require('uuid').v1;

const attachment = require('./attachments');
const {
  getRateLimitDelay, rateLimit, getRequestTimeout, encodeWWWFormParam,
} = require('./helpers');
const { getSecret, refreshToken } = require('./authClientUtils');

const HTTP_ERROR_CODE_REBOUND = new Set([408, 423, 429, 500, 502, 503, 504]);
const REFRESH_TOKEN_RETRIES = process.env.REFRESH_TOKEN_RETRIES ? parseInt(process.env.REFRESH_TOKEN_RETRIES, 10) : 10;

const methodsMap = {
  DELETE: 'delete',
  GET: 'get',
  PATCH: 'patch',
  POST: 'post',
  PUT: 'put',
};

const bodyEncodings = {
  FORM_DATA: 'form-data',
  RAW: 'raw',
  URLENCODED: 'urlencoded',
};

const bodyMultipartBoundary = '__X_ELASTICIO_BOUNDARY__';

const contentTypes = {
  FORM_DATA: 'multipart/form-data',
  URLENCODED: 'application/x-www-form-urlencoded',
  TEXT: 'text/plain',
  APP_JSON: 'application/json',
  APP_XML: 'application/xml',
  TEXT_XML: 'text/xml',
  HTML: 'text/html',
};

const formattedFormDataHeader = `multipart/form-data; charset=utf8; boundary=${bodyMultipartBoundary}`;

const authTypes = {
  NO_AUTH: 'noauth',
  BASIC: 'basic',
  API_KEY: 'api_key',
  OAUTH2: 'oauth2',
};

const CREDS_HEADER_TYPE = 'CREDS_HEADER_TYPE';

/**
 * Executes the action's/trigger's logic by sending a request to the assigned URL and emitting response to the platform.
 * The function returns a Promise sending a request and resolving the response as platform message.
 *
 * @param {Object} msg incoming messages which is empty for triggers
 * @param {Object} cfg object to retrieve triggers configuration values, such as, for example, url and userId
 * @returns {Object} promise resolving a message to be emitted to the platform
 */
/* eslint-disable-next-line func-names */
module.exports.processMethod = async function (msg, cfg) {
  const emitter = this;

  emitter.logger.trace('Input message: %o', JSON.stringify(msg));
  emitter.logger.trace('Input configuration: %o', JSON.stringify(cfg));

  const config = cfg.reader;

  if (!config.url) {
    throw new Error('URL is required');
  }
  const url = JsonataTransform.jsonataTransform(msg, { expression: config.url }, emitter);
  const { method, headers } = config;
  const body = config.body || {};
  const followRedirect = cfg.followRedirect !== 'doNotFollowRedirects';
  const requestTimeout = getRequestTimeout(emitter.logger, cfg);

  if (!method) {
    throw new Error('Method is required');
  }

  const formattedMethod = methodsMap[method];

  if (!formattedMethod) {
    throw new Error(
      `Method "${method}" isn't one of the: ${Object.keys(methodsMap)}.`,
    );
  }

  const rateLimitDelay = getRateLimitDelay(emitter.logger, cfg);

  /*
   if cfg.followRedirect has value doNotFollowRedirects
   or cfg.followRedirect is not exists
   followRedirect option should be true
   */
  const requestOptions = {
    method: formattedMethod,
    uri: url,
    followRedirect,
    followAllRedirects: followRedirect,
    gzip: true,
    resolveWithFullResponse: true,
    simple: false,
    encoding: null,
    strictSSL: !cfg.noStrictSSL,
    timeout: requestTimeout,
  };

  const existingAuthHeader = (headers || []).find((header) => header._type === CREDS_HEADER_TYPE);

  const secret = await getSecret(this, cfg.secretId);
  switch (secret.type) {
    case authTypes.BASIC:
      if (existingAuthHeader) {
        existingAuthHeader.key = '';
      }

      headers.push({
        key: 'Authorization',
        // eslint-disable-next-line no-buffer-constructor
        value: `"Basic ${Buffer.from(`${secret.credentials.username}:${secret.credentials.password}`, 'utf8').toString('base64')}"`,
      });

      break;

    case authTypes.API_KEY:
      if (existingAuthHeader) {
        existingAuthHeader.key = '';
      }

      headers.push({
        key: secret.credentials.headerName,
        value: `"${secret.credentials.headerValue}"`,
      });

      break;
    case authTypes.OAUTH2:
      emitter.logger.trace('auth = %j', secret);
      headers.push({
        key: 'Authorization',
        value: `"Bearer ${secret.credentials.access_token}"`,
      });
      break;
    default:
      if (existingAuthHeader) {
        existingAuthHeader.key = '';
      }
  }

  if (headers && headers.length) {
    requestOptions.headers = headers.reduce(
      (headers, header) => {
        if (!header.key || !header.value) {
          return headers;
        }
        headers[header.key.toLowerCase()] = JsonataTransform.jsonataTransform(msg, { expression: header.value }, emitter);
        return headers;
      }, requestOptions.headers || {},
    );
  }

  emitter.logger.trace('Request options: %o', JSON.stringify(requestOptions));

  return buildRequestBody()
    .then(async () => {
      emitter.logger.trace('Request body: %o', requestOptions.body);
      let result;
      let iteration = REFRESH_TOKEN_RETRIES;
      do {
        iteration -= 1;
        try {
          result = await request(requestOptions); // eslint-disable-line
          break;
        } catch (e) {
          this.logger.error('got error', e);
          if ((e.statusCode === 403 || e.statusCode === 401) && secret.type === authTypes.OAUTH2) {
            try {
              this.logger.info('going to refresh token', cfg);
              const token = await refreshToken(this, cfg.secretId); // eslint-disable-line
              this.logger.info('refreshed token', token);
              requestOptions.headers.authorization = `Bearer ${token}`;
            } catch (e) {
              this.logger.error(e, 'failed to refresh token');
            }
          } else {
            throw e;
          }
        }
      } while (iteration > 0);
      if (!result) {
        throw new Error('failed to fetch and/or refresh token, retries exceeded');
      }
      return result;
    })
    .then(checkErrors)
    .then(processResponse)
    .then(async (result) => {
      emitter.logger.trace('Request output: %j', result);

      if (cfg.splitResult && Array.isArray(result.body)) {
      // Walk through chain of promises: https://stackoverflow.com/questions/30445543/execute-native-js-promise-in-series
      // eslint-disable-next-line no-restricted-syntax
        for (const item of result.body) {
          const output = messages.newMessageWithBody({
            headers: result.headers,
            body: item,
            statusCode: result.statusCode,
            statusMessage: result.statusMessage,
          });
          output.attachments = msg.attachments;
          // eslint-disable-next-line no-await-in-loop
          await emitter.emit('data', output);
        }
      } else {
        const output = messages.newMessageWithBody(result);
        output.attachments = msg.attachments;
        await emitter.emit('data', output);
      }
      await rateLimit(emitter.logger, rateLimitDelay);
      await emitter.emit('end');
    })
    .catch(await buildErrorStructure);

  function buildRequestBody() {
    if (formattedMethod !== methodsMap.GET) {
      const bodyEncoding = {
        [contentTypes.FORM_DATA]: bodyEncodings.FORM_DATA,
        [contentTypes.URLENCODED]: bodyEncodings.URLENCODED,
      }[body.contentType] || bodyEncodings.RAW;

      // eslint-disable-next-line default-case
      switch (bodyEncoding) {
        case bodyEncodings.FORM_DATA:
          // eslint-disable-next-line no-case-declarations
          const existingContentTypeHeader = headers.find((header) => (
            // eslint-disable-next-line no-sequences
            header.key.match(/^content-type$/i),
            header.value === contentTypes.FORM_DATA
          ));

          if (existingContentTypeHeader) {
            existingContentTypeHeader.value = `"${formattedFormDataHeader}"`;
          } else {
            headers.push({
              key: 'Content-Type',
              value: `"${formattedFormDataHeader}"`,
            });
          }
          if (msg.attachments) {
            const attachments = Object.keys(msg.attachments).map(
              // eslint-disable-next-line no-unused-vars
              (key, index) => ({
                key,
                value: msg.attachments[key].url,
                filename: key,
                'Content-Type': msg.attachments[key]['content-type'],
              }),
            );

            // eslint-disable-next-line prefer-spread
            body.formData.push.apply(body.formData, attachments);
          }

          emitter.logger.trace('formData: %o', body.formData);

          requestOptions.body = `--${bodyMultipartBoundary}`;

          return body.formData.reduce(
            (p, x) => p.then(() => processItem(x)), Promise.resolve(),
          ).then(() => {
            requestOptions.body = `${requestOptions.body}--`;
            return requestOptions.body;
          });

        case bodyEncodings.RAW:
          if (!body.raw) {
            break;
          }

          requestOptions.body = JsonataTransform.jsonataTransform(msg, { expression: body.raw }, emitter);
          if (typeof requestOptions.body === 'object') {
            requestOptions.body = JSON.stringify(requestOptions.body);
          }
          break;

        case bodyEncodings.URLENCODED:
          if (!body.urlencoded.length) {
            break;
          }

          // eslint-disable-next-line no-case-declarations
          const evaluatedUrlencoded = body.urlencoded.map((pair) => ({
            key: pair.key,
            value: JsonataTransform.jsonataTransform(msg, { expression: pair.value }, emitter),
          })).reduce((str, pair, index) => {
            const equation = `${encodeWWWFormParam(pair.key)}=${encodeWWWFormParam(pair.value)}`;

            return index === 0 ? equation : `${str}&${equation}`;
          }, null);

          requestOptions.body = evaluatedUrlencoded;
          break;
      }
      emitter.logger.trace('Request body: %o', requestOptions.body);
    }

    function processItem(item) {
      if (item.filename) {
        return request(item.value).then((result) => {
          requestOptions.body = `${requestOptions.body}\nContent-Disposition: form-data; name="${item.key}"; filename:"${item.filename}"\nContent-Type:${item['Content-Type']}\n\n${result}\n--${bodyMultipartBoundary}`;
        }).catch((result) => {
          emitter.logger.trace(result);
        });
      }
      return Promise.resolve().then(() => {
        requestOptions.body = `${requestOptions.body}\nContent-Disposition: form-data; name="${item.key}"\n\n`
            + `${JsonataTransform.jsonataTransform(msg, { expression: item.value }, emitter)}\n--${bodyMultipartBoundary}`;
      });
    }

    return Promise.resolve(requestOptions.body);
  }

  async function buildErrorStructure(e) {
    if (cfg.enableRebound && (HTTP_ERROR_CODE_REBOUND.has(e.code)
      || e.message.includes('DNS lookup timeout'))) {
      emitter.logger.info('Component error: %o', e);
      emitter.logger.info('Starting rebound');
      emitter.emit('rebound', e.message);
      emitter.emit('end');
    } else if (cfg.dontThrowErrorFlg) {
      const output = {
        errorCode: e.code,
        errorMessage: e.message,
        errorStack: e.stack,
      };
      emitter.logger.trace('Component output: %o', output);
      await emitter.emit('data', messages.newMessageWithBody(output));
      await rateLimit(emitter.logger, rateLimitDelay);
      await emitter.emit('end');
    } else {
      emitter.logger.error('Component error: %o', e);
      if (e.message === 'Error: ESOCKETTIMEDOUT') {
        e.message = `Timeout error! Waiting for response more than ${requestTimeout} ms`;
      }
      await emitter.emit('error', e);
      await rateLimit(emitter.logger, rateLimitDelay);
      await emitter.emit('end');
    }
  }

  /*
  * https://user-images.githubusercontent.com/13310949/41960520-9bd468ca-79f8-11e8-83f4-d9b2096deb6d.png
  * */
  function checkErrors(response) {
    const { statusCode } = response;
    emitter.logger.info('Response statusCode %d', statusCode);
    if (statusCode >= 200 && statusCode < 300) {
      return Promise.resolve(response);
    }
    if (statusCode >= 300 && statusCode < 400) {
      if (followRedirect) {
        const REDIRECTION_ERROR = `${response.statusMessage
          || 'Redirection error.'} Please check "Follow redirect mode" if You want to use redirection in your request.`;
        if (cfg.dontThrowErrorFlg) {
          return Promise.resolve({
            statusCode,
            statusMessage: REDIRECTION_ERROR,
            headers: response.headers,
            body: response.body,
          });
        }
        const err = new Error(
          `Code: ${statusCode} Headers: ${JSON.stringify(
            response.headers,
          )} Body: ${JSON.stringify(
            response.body,
          )}. Error Message: ${REDIRECTION_ERROR}`,
        );
        err.code = statusCode;
        err.name = 'HTTP error';
        return Promise.reject(err);
      }
      return Promise.resolve(response);
    } if (statusCode >= 400 && statusCode < 1000) {
      if (cfg.dontThrowErrorFlg) {
        return Promise.resolve({
          headers: response.headers,
          body: response.body,
          statusCode,
          statusMessage: `${response.statusMessage || 'HTTP error.'}`,
        });
      }
      let errString = `Code: ${statusCode} Message: ${response.statusMessage || 'HTTP error'}`;
      let { body } = response;
      if (body && body.toString('utf8') !== '') {
        body = body.toString('utf8');
        errString = `${errString} Body: ${body}`;
      }
      const err = new Error(errString);
      err.code = statusCode;
      err.name = 'HTTP error';
      err.body = body;
      return Promise.reject(err);
    }
  }

  /*
  * parse response structure
  *
  * 1) If body is not exists return empty object {}
  * 2) If Content-type is exists in response try to parse by content type
  * 3) If Content-type is not exists try to parse as JSON. If we get parsing error
  * we should return response as is.
  *
  */
  function processResponse(response) {
    emitter.logger.trace('HTTP Response headers: %j', response.headers);
    emitter.logger.trace('HTTP Response body: %o', response.body.toString('utf8'));

    if (response.body && response.body.byteLength === 0) {
      return Promise.resolve(buildResponseStructure());
    }

    const contType = response.headers['content-type'];

    emitter.logger.info('Content type: %o', contType);
    if (contType) {
      if (contType.includes('json')) {
        return Promise.resolve(response.body).then(JSON.parse).then(buildResponseStructure);
      } if (contType.includes('xml')) {
        emitter.logger.info('trying to parse as XML');
        const parseOptions = {
          trim: false,
          normalize: false,
          explicitArray: false,
          normalizeTags: false,
          attrkey: '_attr',
          tagNameProcessors: [
            (name) => name.replace(':', '-'),
          ],
        };
        return xml2js(response.body, parseOptions)
          .then(buildResponseStructure).then((result) => {
            emitter.logger.info('successfully parsed');
            return result;
          });
      }
      if (contType.includes('image') || contType.includes('msword')
          || contType.includes('msexcel') || contType.includes('pdf')
          || contType.includes('csv') || contType.includes('octet-stream')
          || contType.includes('binary')) {
        const attachmentName = `${uuidv1()}_${new Date().getTime()}`;
        return attachment.addAttachment.call(emitter, msg, attachmentName, response.body,
          response.headers['content-length'], contType, url)
          .then(() => {
            emitter.logger.info(
              `binary data with ${JSON.stringify({
                [attachmentName]: {
                  size: msg.attachments[attachmentName].size,
                  'content-type': msg.attachments[attachmentName]['content-type'],
                },
              })} successfully saved to attachments`,
            );
            return {
              headers: response.headers,
              statusCode: response.statusCode,
              statusMessage: response.statusMessage,
              attachments: msg.attachments[attachmentName],
            };
          });
      }
      return Promise.resolve(
        buildResponseStructure(response.body.toString('utf8')),
      );
    }
    emitter.logger.info('Unknown content-type received. trying to parse as JSON');
    return Promise.resolve(response.body).then(JSON.parse)
      .then(buildResponseStructure)
      .catch((e) => {
        emitter.logger.error(
          'Parsing to JSON object is failed. Error: %o. Returning response as is',
          e,
        );
        return buildResponseStructure(response.body.toString('utf8'));
      });

    function buildResponseStructure(body) {
      return {
        headers: response.headers,
        body,
        statusCode: response.statusCode,
        statusMessage: response.statusMessage,
      };
    }
  }
};
