const client = require('elasticio-rest-node')();
const url = require('url');
const http = require('http');
const { Duplex } = require('stream');

function addAttachment(msg, name, body, contentLength, contentType, sourceUrl) {
  const self = this;

  function getUrls() {
    return client.resources.storage.createSignedUrl();
  }

  // eslint-disable-next-line no-shadow
  function createRequestOptions(putUrl, contentLength) {
    const opts = url.parse(putUrl);
    opts.method = 'PUT';
    opts.headers = {
      'Content-Length': contentLength,
    };
    return opts;
  }

  function bufferToStream(buffer) {
    const stream = new Duplex();
    stream.push(buffer);
    stream.push(null);
    return stream;
  }

  // eslint-disable-next-line no-shadow
  function uploadFile(urls, contentLength, contentType) {
    const options = createRequestOptions(urls.put_url, contentLength);
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        self.logger.trace('Status: %d', res.statusCode);
        self.logger.trace('Headers: %j', res.headers);
      });
      req.on('error', (e) => {
        self.logger.error('problem with request: %o', e.message);
        reject(e);
      });
      const stream = bufferToStream(body);
      stream.pipe(req);

      stream.on('end', () => {
        self.logger.debug('Streaming completed');
        req.end();
        resolve();
      });
      // eslint-disable-next-line no-param-reassign
      msg.attachments = {};
      // eslint-disable-next-line no-param-reassign
      msg.attachments[name] = {
        url: urls.get_url,
        size: contentLength,
        'content-type': contentType,
        sourceUrl,
      };
    });
  }

  return getUrls().then((result) => {
    self.logger.trace('createSignedUrl result: %j', result);
    self.logger.trace('Uploading to url: %s', result.put_url);
    return uploadFile(result, contentLength, contentType);
  });
}

exports.addAttachment = addAttachment;
