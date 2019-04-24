var express = require('express');
var router = express.Router();

const MyInfoClient = require('my-info-sg');
const restClient = require('superagent-bluebird-promise');
const path = require('path');
const url = require('url');
const util = require('util');
const Promise = require('bluebird');
const _ = require('lodash');
const querystring = require('querystring');
const crypto = require('crypto');
const colors = require('colors');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


// ####################
// Setup Configuration
// ####################

// LOADED FRON ENV VARIABLE: public key from MyInfo Consent Platform given to you during onboarding for RSA digital signature
var _publicCertContent = process.env.MYINFO_SIGNATURE_CERT_PUBLIC_CERT;
// LOADED FRON ENV VARIABLE: your private key for RSA digital signature
var _privateKeyContent = process.env.DEMO_APP_SIGNATURE_CERT_PRIVATE_KEY;
// LOADED FRON ENV VARIABLE: your client_id provided to you during onboarding
var _clientId = process.env.MYINFO_APP_CLIENT_ID;
// LOADED FRON ENV VARIABLE: your client_secret provided to you during onboarding
var _clientSecret = process.env.MYINFO_APP_CLIENT_SECRET;
// redirect URL for your web application
var _redirectUrl = process.env.MYINFO_APP_REDIRECT_URL;


// URLs for MyInfo APIs
var _authLevel = process.env.AUTH_LEVEL;

var _authApiUrl = process.env.MYINFO_API_AUTHORISE;
var _tokenApiUrl = process.env.MYINFO_API_TOKEN;
var _personApiUrl = process.env.MYINFO_API_PERSON;

var _attributes = "uinfin,name,sex,race,nationality,dob,email,mobileno,regadd,housingtype,hdbtype,marital,edulevel,noa-basic,ownerprivate,cpfcontributions,cpfbalances";

/* GET home page. */
router.get('/', function(req, res, next) {
  res.sendFile(path.join(__dirname + '/../views/html/index.html'));
});

// callback function - directs back to home page
router.get('/callback', function(req, res, next) {
  res.sendFile(path.join(__dirname + '/../views/html/index.html'));
});

// function for getting environment variables to the frontend
router.get('/getEnv', function(req, res, next) {
  if (_clientId == undefined || _clientId == null)
    res.jsonp({
      status: "ERROR",
      msg: "client_id not found"
    });
  else
    res.jsonp({
      status: "OK",
      clientId: _clientId,
      redirectUrl: _redirectUrl,
      authApiUrl: _authApiUrl,
      attributes: _attributes,
      authLevel: _authLevel
    });
});

// function for frontend to call backend
router.post('/getPersonData', function(req, res, next) {
  // get variables from frontend
  var code = req.body.code;

  var data;
  var request;

  var myInfoClient = new MyInfoClient({
    baseUrl: 'https://sandbox.api.myinfo.gov.sg',
    authLevel: _authLevel,
    clientId: _clientId,
    clientSecret: _clientSecret,
    privateKeyContent: _privateKeyContent,
    publicCertContent: _publicCertContent,
    redirectUrl: _redirectUrl,
  });
  
  myInfoClient.getToken(code)
    .then(function(accessToken) {
      return myInfoClient.getPerson(accessToken, _attributes);
    })
    .then(function(personData) {
      console.log("Person Data (Decoded):".green);
      console.log(JSON.stringify(personData))
      res.jsonp({ status: "OK", text: personData });
    })
    .catch(function(error) {
      console.error(error);
      res.jsonp({ status: "ERROR", msg: error });
    });
});

module.exports = router;
