const _ = require('lodash');
const crypto = require('crypto');
const superagent = require('superagent');
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

  getAuthoriseUrl(purpose, attributes, redirectUrl) {
    const state = crypto.randomBytes(16).toString('hex');
    const authoriseUrl = `${this._authApiUrl}\
?client_id=${this._clientId}\
&attributes=${attributes.join(',')}\
&purpose=${purpose}\
&state=${state}\
&redirect_uri=${redirectUrl || this._redirectUrl}`;
    return { authoriseUrl, state };
  }

  async getToken(code, redirectUrl) {
    const {
      _authLevel, _clientId, _clientSecret, _privateKeyPath, _redirectUrl, _tokenApiUrl,
    } = this;

    if (_authLevel !== 'L0' && _authLevel !== 'L2') throw new Error('UNKNOWN AUTH LEVEL');

    const params = {
      grant_type: 'authorization_code',
      redirect_uri: redirectUrl || _redirectUrl,
      client_id: _clientId,
      client_secret: _clientSecret,
      code,
    };

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    };

    if (_authLevel === 'L2') {
      const authHeaders = securityHelper.generateAuthorizationHeader(
        _tokenApiUrl,
        params,
        'POST',
        'application/x-www-form-urlencoded',
        _authLevel,
        _clientId,
        _privateKeyPath,
        _clientSecret,
      );

      _.set(headers, 'Authorization', authHeaders);
    }

    const response = await superagent.post(_tokenApiUrl)
      .set(headers)
      .send(params)
      .buffer(true);

    return { accessToken: _.get(response, 'body.access_token') };
  }

  async getPerson(accessToken, attributes) {
    const {
      _authLevel, _privateKeyPath, _publicCertPath,
    } = this;

    if (_authLevel !== 'L0' && _authLevel !== 'L2') throw new Error('UNKNOWN AUTH LEVEL');

    // validate and decode token to get UINFIN
    const decoded = securityHelper.verifyJWS(accessToken, _publicCertPath);
    if (!decoded) throw new Error('INVALID TOKEN');

    const uinfin = decoded.sub;
    if (!uinfin) throw new Error('UINFIN NOT FOUND');

    const response = await this._createPersonRequest(uinfin, accessToken, attributes);
    const responseText = response.text;

    if (_authLevel === 'L0') {
      const personData = JSON.parse(responseText);
      return { person: personData };
    }

    // _authLevel === 'L2'
    const personDataJWS = await securityHelper.decryptJWE(responseText, _privateKeyPath);
    if (!personDataJWS) throw new Error('INVALID DATA OR SIGNATURE FOR PERSON DATA');

    const decodedPersonData = securityHelper.verifyJWS(personDataJWS, _publicCertPath);
    if (!decodedPersonData) throw new Error('INVALID DATA OR SIGNATURE FOR PERSON DATA');

    return { person: decodedPersonData };
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
    return superagent.get(url)
      .set(headers)
      .query(params)
      .buffer(true);
  }
}

module.exports = MyInfoClient;
