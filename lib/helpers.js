const MAX_DELAY_BETWEEN_CALLS = 1140 * 1000; // 1140 = 19 minutes in seconds

const REQUEST_TIMEOUT = process.env.REQUEST_TIMEOUT
  ? parseInt(process.env.REQUEST_TIMEOUT, 10)
  : 100000; // 100s

function sleep(delay) {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

function getDelay(delay) {
  const delayInt = parseInt(delay, 10);
  if (!delayInt || delayInt < 1) {
    // TODO: Edit Error message if config fields names will be changed
    throw new Error('Configuration error: Delay value should be a positive integer');
  }
  return delayInt;
}

function getCallCount(callCount) {
  const callCountInt = parseInt(callCount, 10);
  if (!callCountInt || callCountInt < 1) {
    // TODO: Edit Error message if config fields names will be changed
    throw new Error('Configuration error: Call Count value should be a positive integer');
  }
  return callCountInt;
}

function getDelayBetweenCalls(delay, callCount) {
  const delayBetweenCalls = (delay * 1000) / callCount;
  if (delayBetweenCalls < 0) {
    // TODO: Edit Error message if config fields names will be changed
    throw new Error('Configuration error: Delay Between Calls should be positive value');
  }
  if (delayBetweenCalls > MAX_DELAY_BETWEEN_CALLS) {
    // TODO: Edit Error message if config fields names will be changed
    throw new Error(`Configuration error: Delay Between Calls should be less than ${MAX_DELAY_BETWEEN_CALLS} milliseconds`);
  }
  return delayBetweenCalls;
}

function getRateLimitDelay(logger, cfg) {
  logger.info('Checking rate limit parameters...');
  const { delay, callCount } = cfg;
  if (callCount && !delay) {
    // TODO: Edit Error message if config fields names will be changed
    throw new Error('Call Count value should be used only in pair with Delay option');
  }
  let rateLimitDelay = null;
  if (delay) {
    const delayInt = getDelay(delay);
    logger.debug('Delay is set to:', delay);
    if (callCount) {
      const callCountInt = getCallCount(callCount);
      logger.debug('Call Count is set to:', callCountInt);
      rateLimitDelay = getDelayBetweenCalls(delayInt, callCountInt);
    } else {
      rateLimitDelay = delay * 1000;
    }
    logger.debug('rateLimitDelay is:', rateLimitDelay);
  }
  return rateLimitDelay;
}

async function rateLimit(logger, delay) {
  if (delay) {
    logger.info(`Delay Between Calls is set to: ${delay} ms`);
    logger.debug('Delay started', new Date());
    await sleep(delay);
    logger.debug('Delay finished', new Date());
  } else {
    logger.info('Delay Between Calls is not set, process message without delay...');
  }
}

function getRequestTimeout(logger, cfg) {
  const requestTimeout = cfg.requestTimeoutPeriod
    ? parseInt(cfg.requestTimeoutPeriod, 10)
    : REQUEST_TIMEOUT;

  if (!(requestTimeout > 0) || requestTimeout > 1140000) {
    logger.error('Incorrect Request Timeout input');
    throw new Error(`Incorrect Request Timeout input found - '${requestTimeout}'`);
  }

  return requestTimeout;
}

/**
 * Method to encode x-www-form-urlencoded parameter.
 * Additional replacing requires cause `encodeURIComponent` methods not working for !'()* symbols
 * Also ' ' should be encoded as '+' which requires an additional replacing for '%20'
 *
 * @param {string} param input form key or value parameter
 */
function encodeWWWFormParam(param) {
  return encodeURIComponent(param)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)
    .replace(/%20/g, '+');
}

exports.sleep = sleep;
exports.rateLimit = rateLimit;
exports.getRateLimitDelay = getRateLimitDelay;
exports.getRequestTimeout = getRequestTimeout;
exports.encodeWWWFormParam = encodeWWWFormParam;
