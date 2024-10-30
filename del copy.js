const axios = require('axios');
const { messages } = require('elasticio-node');

async function run(msg, cfg) {
  const url = 'https://nodered.psteam.pw/test/123';

  let response;
  let error;
  const maxRetries = 5;

  try {
    response = await axios({
      url,
      maxRedirects: 0,
      method: 'GET',
      timeout: 1
    });
  } catch (err) {
    console.log(err.code);
    error = err;
    const errMsg = err.response ? getErrMsg(err.response) : err.message;
    console.log(errMsg);
  }
}

function getErrMsg(errResponse) {
  const statusText = errResponse?.statusText || 'unknown';
  const status = errResponse?.status || 'unknown';
  const data = errResponse?.data || 'no body found';
  return `Got error "${statusText}", status - "${status}", body: ${JSON.stringify(data)}`;
}

run();
