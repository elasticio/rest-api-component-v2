/* eslint-disable default-param-last */
import { messages } from 'elasticio-node';
import * as commons from '@elastic.io/component-commons-library';
import { writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Cfg, getUserAgent } from '../utils';
import Client from '../Client';

let client: Client;
const TMP_DATA_PATH = '/tmp/data';

export async function processAction(msg: any = {}, cfg: Cfg) {
  this.logger.info('"HTTP request (axios)" trigger started');

  msg.body ||= {};
  client ||= new Client(this, cfg);
  client.setLogger(this.logger);
  client.setCfgAndMsg(cfg, msg);

  const response = await client.apiRequest();
  if (response === 'rebound') {
    await this.emit('rebound', new Error('Rebound due to an error'));
    return null;
  }

  const result: any = {
    statusCode: response.status,
    HTTPHeaders: response.headers
  };

  if (cfg.downloadAsAttachment) {
    this.logger.info('Got new file, start uploading to internal storage');
    await writeFile(TMP_DATA_PATH, response.data);
    const attachmentProcessor = new commons.AttachmentProcessor(getUserAgent(), msg.id);
    const getAttachment = async () => createReadStream(TMP_DATA_PATH);
    const attachmentId = await attachmentProcessor.uploadAttachment(getAttachment);
    const attachmentUrl = attachmentProcessor.getMaesterAttachmentUrlById(attachmentId);
    result.attachmentUrl = attachmentUrl;
  } else {
    result.responseBody = response.data;
  }

  this.logger.info('request is done, emitting...');
  return messages.newMessageWithBody(result);
}

module.exports.process = processAction;
