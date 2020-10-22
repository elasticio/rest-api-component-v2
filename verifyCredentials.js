const authTypes = {
  BASIC: 'Basic Auth',
  DIGEST: 'Digest Auth',
  OAUTH2: 'OAuth2',
};

/**
 * Executes the verification logic by checking that fields are not empty using the provided apiKey.
 *
 * @param credentials object to retrieve apiKey from
 * @returns Promise which resolves true
 */
function verify(credentials) {
  // access the value of the auth field defined in credentials section of component.json
  const { type, basic, oauth2 } = credentials.auth;

  if (type === authTypes.BASIC) {
    if (!basic.username) {
      this.logger.error('Error: Username is required for basic auth');
      throw new Error('Username is required for basic auth');
    }

    if (!basic.password) {
      this.logger.error('Error: Password is required for basic auth');
      throw new Error('Password is required for basic auth');
    }
  } else if (type === authTypes.OAUTH2) {
    const { keys } = oauth2;
    let errMessage;
    if (!keys) {
      errMessage = 'Error: OAuth2 provider hasn`t returned keys for current credentials';
    } else if (!keys.access_token) {
      errMessage = 'Error: No access tokens were returned by the OAuth2 provider';
    } else if (!keys.refresh_token) {
      errMessage = 'Error: No refresh tokens were returned by the OAuth2 provider. Try to add access_type:offline as an additional parameter';
    }
    if (errMessage) {
      this.logger.error(errMessage);
      throw new Error(errMessage);
    }
  }

  return Promise.resolve(true);
}

module.exports = verify;
