const _ = require('lodash');
const Promise = require('bluebird');
const crypto = require("crypto");
const querystring = require('querystring');
const restClient = require('superagent-bluebird-promise');
const securityHelper = require('./security');

class MyInfoClient {
  constructor(options) {
    this._authApiUrl = options.baseUrl + '/com/v3/authorise';
    this._personApiUrl = options.baseUrl + '/com/v3/person';
    this._tokenApiUrl = options.baseUrl + '/com/v3/token';
    this._authLevel = options.authLevel;
    this._clientId = options.clientId;
    this._clientSecret = options.clientSecret;
    this._privateKeyContent = options.privateKeyContent;
    this._publicCertContent = options.publicCertContent;
    this._redirectUrl = options.redirectUrl;
  }
  
  getAuthoriseUrl(purpose, attributes) {
    const nonceValue = crypto.randomBytes(16).toString("hex");
    var authoriseUrl = this._authApiUrl + "?client_id=" + this._clientId
      + "&attributes="+ attributes.join(',')
      + "&purpose=" + purpose
      + "&state=" + nonceValue
      + "&redirect_uri=" + this._redirectUrl;
    return authoriseUrl;
  }
    
  getToken(code) {
    var self = this;
    
    return new Promise(function (resolve, reject) {
      var _authLevel = self._authLevel;
      var _clientId = self._clientId;
      var _clientSecret = self._clientSecret;
      var _privateKeyContent = self._privateKeyContent;
      var _redirectUrl = self._redirectUrl;
      var _tokenApiUrl = self._tokenApiUrl;
      
      var cacheCtl = "no-cache";
      var contentType = "application/x-www-form-urlencoded";
      var method = "POST";

      // assemble params for Token API
      var strParams = "grant_type=authorization_code" +
        "&code=" + code +
        "&redirect_uri=" + _redirectUrl +
        "&client_id=" + _clientId +
        "&client_secret=" + _clientSecret;
      var params = querystring.parse(strParams);


      // assemble headers for Token API
      var strHeaders = "Content-Type=" + contentType + "&Cache-Control=" + cacheCtl;
      var headers = querystring.parse(strHeaders);

      // Add Authorisation headers for connecting to API Gateway
      var authHeaders = null;
      if (_authLevel == "L0") {
        // No headers
      } else if (_authLevel == "L2") {
        authHeaders = securityHelper.generateAuthorizationHeader(
          _tokenApiUrl,
          params,
          method,
          contentType,
          _authLevel,
          _clientId,
          _privateKeyContent,
          _clientSecret
        );
      } else {
        throw new Error("Unknown Auth Level");
      }

      if (!_.isEmpty(authHeaders)) {
        _.set(headers, "Authorization", authHeaders);
      }


      var request = restClient.post(_tokenApiUrl);

      // Set headers
      if (!_.isUndefined(headers) && !_.isEmpty(headers))
        request.set(headers);

      // Set Params
      if (!_.isUndefined(params) && !_.isEmpty(params))
        request.send(params);

      request
        .buffer(true)
        .end(function(callErr, callRes) {
          if (callErr) {
            // ERROR
            reject(callErr);
          } else {
            // SUCCESSFUL
            var data = {
              body: callRes.body,
              text: callRes.text
            };

            var accessToken = data.body.access_token;
            if (accessToken == undefined || accessToken == null) {
              reject(new Error('ACCESS TOKEN NOT FOUND'));
            }

            resolve(accessToken);
          }
        });
    });
  };
  
  getPerson(accessToken, attributes) {
    var self = this;
    
    return new Promise(function(resolve, reject) {
      var _authLevel = self._authLevel;
      var _privateKeyContent = self._privateKeyContent;
      var _publicCertContent = self._publicCertContent;
      

      // validate and decode token to get UINFIN
      var decoded = securityHelper.verifyJWS(accessToken, _publicCertContent);
      if (decoded == undefined || decoded == null) {
        reject(new Error("INVALID TOKEN"));
      }


      var uinfin = decoded.sub;
      if (uinfin == undefined || uinfin == null) {
        reject(new Error("UINFIN NOT FOUND"));
      }

      // **** CALL PERSON API ****
      var request = self._createPersonRequest(uinfin, accessToken, attributes.join(','));

      // Invoke asynchronous call
      request
        .buffer(true)
        .end(function(callErr, callRes) {
          if (callErr) {
            reject(callErr);
          } else {
            // SUCCESSFUL
            var data = {
              body: callRes.body,
              text: callRes.text
            };
            var personData = data.text;
            if (personData == undefined || personData == null) {
              reject(new Error("PERSON DATA NOT FOUND"));
            } else {

              if (_authLevel == "L0") {
                personData = JSON.parse(personData);
                // personData = securityHelper.verifyJWS(personData, _publicCertContent);

                if (personData == undefined || personData == null) {
                  reject(new Error("INVALID DATA OR SIGNATURE FOR PERSON DATA"));
                }

                // successful. return data back to frontend
                resolve(personData);

              }
              else if(_authLevel == "L2"){

                var jweParts = personData.split("."); // header.encryptedKey.iv.ciphertext.tag
                securityHelper.decryptJWE(jweParts[0], jweParts[1], jweParts[2], jweParts[3], jweParts[4], _privateKeyContent)
                  .then(personDataJWS => {
                    if (personDataJWS == undefined || personDataJWS == null) {
                      reject(new Error("INVALID DATA OR SIGNATURE FOR PERSON DATA"));
                    }

                    var decodedPersonData = securityHelper.verifyJWS(personDataJWS, _publicCertContent);
                    if (decodedPersonData == undefined || decodedPersonData == null) {
                      reject(new Error("INVALID DATA OR SIGNATURE FOR PERSON DATA"));
                    }

                    // successful. return data back to frontend
                    resolve(decodedPersonData);
                  })
              }
              else {
                reject(new Error("Unknown Auth Level"));
              }
            } // end else
          }
        }); //end asynchronous call
    });
  }
  
  _createPersonRequest(uinfin, validToken, attributes) {
    var _attributes = attributes;
    var _authLevel = this._authLevel;
    var _clientId = this._clientId;
    var _clientSecret = this._clientSecret;
    var _personApiUrl = this._personApiUrl;
    var _privateKeyContent = this._privateKeyContent;
    
    var url = _personApiUrl + "/" + uinfin + "/";
    var cacheCtl = "no-cache";
    var method = "GET";

    // assemble params for Person API
    var strParams = "client_id=" + _clientId +
      "&attributes=" + _attributes;

    var params = querystring.parse(strParams);

    // assemble headers for Person API
    var strHeaders = "Cache-Control=" + cacheCtl;
    var headers = querystring.parse(strHeaders);

    // Add Authorisation headers for connecting to API Gateway
    var authHeaders = securityHelper.generateAuthorizationHeader(
      url,
      params,
      method,
      "", // no content type needed for GET
      _authLevel,
      _clientId,
      _privateKeyContent,
      _clientSecret
    );

    // NOTE: include access token in Authorization header as "Bearer " (with space behind)
    if (!_.isEmpty(authHeaders)) {
      _.set(headers, "Authorization", authHeaders + ",Bearer " + validToken);
    } else {
      _.set(headers, "Authorization", "Bearer " + validToken);
    }

    // invoke person API
    var request = restClient.get(url);

    // Set headers
    if (!_.isUndefined(headers) && !_.isEmpty(headers))
      request.set(headers);

    // Set Params
    if (!_.isUndefined(params) && !_.isEmpty(params))
      request.query(params);

    return request;
  }
}

module.exports = MyInfoClient;
