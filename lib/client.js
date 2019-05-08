const _ = require('lodash');
const Promise = require('bluebird');
const crypto = require('crypto');
const restClient = require('superagent-bluebird-promise');
const securityHelper = require('./security');

class MyInfoClient {
  constructor(options) {
    this._authApiUrl = `${options.baseUrl}/com/v3/authorise`;
    this._personApiUrl = `${options.baseUrl}/com/v3/person`;
    this._tokenApiUrl = `${options.baseUrl}/com/v3/token`;
    this._authLevel = options.authLevel;
    this._clientId = options.clientId;
    this._clientSecret = options.clientSecret;
    this._privateKeyPath = options.privateKeyPath;
    this._publicCertPath = options.publicCertPath;
    this._redirectUrl = options.redirectUrl;
  }

  getAuthoriseUrl(purpose, attributes) {
    const state = crypto.randomBytes(16).toString('hex');
    const authoriseUrl = `${this._authApiUrl}\
?client_id=${this._clientId}\
&attributes=${attributes.join(',')}\
&purpose=${purpose}\
&state=${state}\
&redirect_uri=${this._redirectUrl}`;
    return { authoriseUrl, state };
  }

  getToken(code) {
    const {
      _authLevel, _clientId, _clientSecret, _privateKeyPath, _redirectUrl, _tokenApiUrl,
    } = this;

    return new Promise((resolve, reject) => {
      const params = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: _redirectUrl,
        client_id: _clientId,
        client_secret: _clientSecret,
      };

      // assemble headers for Token API
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      };

      // Add Authorisation headers for connecting to API Gateway
      let authHeaders = null;
      if (_authLevel === 'L0') {
        // No headers
      } else if (_authLevel === 'L2') {
        authHeaders = securityHelper.generateAuthorizationHeader(
          _tokenApiUrl,
          params,
          'POST',
          'application/x-www-form-urlencoded',
          _authLevel,
          _clientId,
          _privateKeyPath,
          _clientSecret,
        );
      } else {
        throw new Error('Unknown Auth Level');
      }

      if (!_.isEmpty(authHeaders)) {
        _.set(headers, 'Authorization', authHeaders);
      }


      const request = restClient.post(_tokenApiUrl);

      // Set headers
      request.set(headers);

      // Set Params
      request.send(params);

      request
        .buffer(true)
        .end((callErr, callRes) => {
          if (callErr) return reject(callErr);

          const accessToken = callRes.body.access_token;
          if (!accessToken) return reject(new Error('ACCESS TOKEN NOT FOUND'));

          return resolve({ accessToken });
        });
    });
  }

  getPerson(accessToken, attributes) {
    const {
      _authLevel, _privateKeyPath, _publicCertPath,
    } = this;

    return new Promise((resolve, reject) => {
      // validate and decode token to get UINFIN
      const decoded = securityHelper.verifyJWS(accessToken, _publicCertPath);
      if (!decoded) return reject(new Error('INVALID TOKEN'));

      const uinfin = decoded.sub;
      if (!uinfin) return reject(new Error('UINFIN NOT FOUND'));

      // **** CALL PERSON API ****
      const request = this._createPersonRequest(uinfin, accessToken, attributes);

      // Invoke asynchronous call
      request
        .buffer(true)
        .end((callErr, callRes) => {
          if (callErr) return reject(callErr);

          // SUCCESSFUL
          let personData = callRes.text;
          if (!personData) return reject(new Error('PERSON DATA NOT FOUND'));

          if (_authLevel === 'L0') {
            personData = JSON.parse(personData);

            if (!personData) return reject(new Error('INVALID DATA OR SIGNATURE FOR PERSON DATA'));

            // successful. return data back to frontend
            return resolve({ person: personData });
          }

          if (_authLevel === 'L2') {
            const [header, encryptedKey, iv, ciphertext, tag] = personData.split('.');
            securityHelper.decryptJWE(header, encryptedKey, iv, ciphertext, tag, _privateKeyPath)
              .then((personDataJWS) => {
                if (!personDataJWS) {
                  return reject(new Error('INVALID DATA OR SIGNATURE FOR PERSON DATA'));
                }

                const decodedPersonData = securityHelper.verifyJWS(personDataJWS, _publicCertPath);
                if (!decodedPersonData) {
                  return reject(new Error('INVALID DATA OR SIGNATURE FOR PERSON DATA'));
                }

                // successful. return data back to frontend
                return resolve({ person: decodedPersonData });
              });
          } else {
            return reject(new Error('Unknown Auth Level'));
          }
        });
    });
  }

  _createPersonRequest(uinfin, validToken, attributes) {
    const {
      _authLevel, _clientId, _clientSecret, _personApiUrl, _privateKeyPath,
    } = this;

    const url = `${_personApiUrl}/${uinfin}/`;

    // assemble params for Person API
    const params = {
      client_id: _clientId,
      attributes: attributes.join(','),
    };

    // assemble headers for Person API
    const headers = { 'Cache-Control': 'no-cache' };

    // Add Authorisation headers for connecting to API Gateway
    const authHeaders = securityHelper.generateAuthorizationHeader(
      url,
      params,
      'GET',
      '', // no content type needed for GET
      _authLevel,
      _clientId,
      _privateKeyPath,
      _clientSecret,
    );

    // NOTE: include access token in Authorization header as 'Bearer ' (with space behind)
    if (!_.isEmpty(authHeaders)) {
      _.set(headers, 'Authorization', `${authHeaders},Bearer ${validToken}`);
    } else {
      _.set(headers, 'Authorization', `Bearer ${validToken}`);
    }

    // invoke person API
    const request = restClient.get(url);

    // Set headers
    request.set(headers);

    // Set Params
    request.query(params);

    return request;
  }
}

module.exports = MyInfoClient;
