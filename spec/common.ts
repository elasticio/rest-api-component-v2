/* eslint-disable import/first */
process.env.LOG_OUTPUT_MODE = 'short';
process.env.API_RETRY_DELAY = '0';
import getLogger from '@elastic.io/component-logger';
import { mock } from 'node:test';

export const getContext = () => ({
  logger: getLogger(),
  emit: mock.fn(),
});

export class StatusCodeError extends Error {
  response: any;

  constructor(status) {
    super('');
    this.response = { status };
    this.message = 'StatusCodeError';
  }
}
