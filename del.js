const client = require('elasticio-rest-node')();
const { messages } = require('elasticio-node');
const axios = require('axios');
const { Readable } = require('stream');

async function run(msg, cfg, snapshot) {
  const url = 'https://filebrowser.psteam.pw/filebrowser/api/public/dl/DUDJ-p1R/Big%20Bunny.mp4'
  const name = 'file_example_MP3_2MG.mp3'
  // const { url, name } = msg.body.body;
  const { put_url, get_url } = await client.resources.storage.createSignedUrl();
  let getDataResponse;
  let contentLength;
  let currentRetry = 0;
  const maxRetries = 10;
  let errorMsg;
  do {
    try {
      this.logger.info('Start getting data');
      getDataResponse = await axios.get(url, { responseType: 'arraybuffer' });
      const dataBuffer = Buffer.from(getDataResponse.data);
      const dataStream = Readable.from(dataBuffer);
      contentLength = dataBuffer.length;
      this.logger.info('Got data, start uploading to internal storage');
      this.logger.info('Signed url: ' + put_url + ' - Content Length: ' + getDataResponse.headers['content-length']);
      // await axios.put(put_url, dataStream, { headers: { 'Content-Length': contentLength } });

      await axios({
        method: 'put',
        url: put_url,
        data: dataStream,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          'content-length': contentLength
        }
      });
      errorMsg = null;
      break;
    } catch (e) {
      if (e.response) {
        let errData;
        if (e.response.data instanceof Readable) {
          errData = await new Promise((resolve, reject) => {
            const chunks = [];
            e.response.data.on('data', (chunk) => { chunks.push(chunk); });
            e.response.data.on('end', () => { const data = Buffer.concat(chunks).toString(); resolve(data); });
          });
        } else if (typeof e.response.data === 'object') {
          errData = JSON.stringify(e.response.data);
        } else {
          errData = e.response.data;
        }
        errorMsg = `Got error with file "${name}" - ${e.response.statusText}, status - ${e.response.status}, body: ${JSON.stringify(errData)}`;
      } else {
        errorMsg = e.message;
      }
      this.logger.error(`Got error ${errorMsg}. Going to retry (${currentRetry + 1} of ${maxRetries})`);
    }
    currentRetry++;
  } while (currentRetry <= maxRetries);
  if (errorMsg) throw new Error(errorMsg);
  this.logger.info(`File "${name}" uploaded successfully`);
  const attachments = {
    [name]: {
      url: get_url,
      size: contentLength,
      'content-type': getDataResponse.headers['content-type'],
      sourceUrl: url,
    },
  };
  const output = messages.newMessageWithBody(attachments);
  output.attachments = attachments;
  await this.emit('data', output);
  this.logger.info('Execution finished');
}
