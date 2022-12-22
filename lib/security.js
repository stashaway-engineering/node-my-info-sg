const _ = require('lodash');
const crypto = require('crypto');
const fs = require('fs');
const jose = require('jose');
const jwt = require('jsonwebtoken');
const qs = require('querystring');

const security = {};

// Sorts a JSON object based on the key value in alphabetical order
function sortJSON(json) {
  if (_.isNil(json)) return json;

  const newJSON = {};
  const keys = Object.keys(json);
  keys.sort();

  for (let i = 0; i < keys.length; i += 1) {
    newJSON[keys[i]] = json[keys[i]];
  }

  return newJSON;
}

/**
 * @param url Full API URL
 * @param params JSON object of params sent, key/value pair.
 * @param method
 * @param appId ClientId
 * @param keyCertContent Private Key Certificate content
 * @param keyCertPassphrase Private Key Certificate Passphrase
 * @returns {string}
 */
function generateSHA256withRSAHeader(url, _params, method, strContentType, appId, keyCertContent, keyCertPassphrase) {
  const nonceValue = crypto.randomBytes(16).toString('hex');
  const timestamp = (new Date()).getTime();
  let params = _params;

  // A) Construct the Authorisation Token
  const defaultApexHeaders = {
    app_id: appId, // App ID assigned to your application
    nonce: nonceValue, // secure random number
    signature_method: 'RS256',
    timestamp, // Unix epoch time
  };

  // Remove params unless Content-Type is "application/x-www-form-urlencoded"
  if (method === 'POST' && strContentType !== 'application/x-www-form-urlencoded') {
    params = {};
  }

  // B) Forming the Signature Base String

  // i) Normalize request parameters
  const baseParams = sortJSON(_.merge(defaultApexHeaders, params));

  let baseParamsStr = qs.stringify(baseParams);
  baseParamsStr = qs.unescape(baseParamsStr);

  // ii) construct request URL ---> url is passed in to this function

  // iii) concatenate request elements
  const baseString = `${method.toUpperCase()}&${url}&${baseParamsStr}`;

  // C) Signing Base String to get Digital Signature
  const signWith = {
    key: fs.readFileSync(keyCertContent, 'utf8'),
  };

  if (!_.isUndefined(keyCertPassphrase) && !_.isEmpty(keyCertPassphrase)) _.set(signWith, 'passphrase', keyCertPassphrase);

  // Load pem file containing the x509 cert & private key & sign the base string with it.
  const signature = crypto.createSign('RSA-SHA256')
    .update(baseString)
    .sign(signWith, 'base64');

  // D) Assembling the Header
  const strApexHeader = `\
PKI_SIGN timestamp="${timestamp}",\
nonce="${nonceValue}",\
app_id="${appId}",\
signature_method="RS256",\
signature="${signature}"`;

  return strApexHeader;
}

/**
 * @param url API URL
 * @param params JSON object of params sent, key/value pair.
 * @param method
 * @param appId API ClientId
 * @param passphrase API Secret or certificate passphrase
 * @returns {string}
 */
security.generateAuthorizationHeader = function generateAuthorizationHeader(
  url,
  params,
  method,
  strContentType,
  authType,
  appId,
  keyCertContent,
  passphrase,
) {
  if (authType !== 'L2') return '';
  return generateSHA256withRSAHeader(url, params, method, strContentType, appId, keyCertContent, passphrase);
};

// Verify & Decode JWS or JWT
security.verifyJWS = function verifyJWS(jws, publicCert) {
  // verify token
  // ignore notbefore check because it gives errors sometimes if the call is too fast.
  try {
    const decoded = jwt.verify(jws, fs.readFileSync(publicCert, 'utf8'), {
      algorithms: ['RS256'],
      ignoreNotBefore: true,
    });
    return decoded;
  } catch (error) {
    // eslint-disable-next-line
    console.error(error);
    throw new Error('ERROR WITH VERIFYING AND DECODING JWE');
  }
};

// Decrypt JWE using private key
security.decryptJWE = async function decryptJWE(jwe, privateKeyPath) {
  try {
    const privateKey = await jose.importPKCS8(fs.readFileSync(privateKeyPath, 'utf8'));
    const { plaintext } = await jose.compactDecrypt(jwe, privateKey);
    return JSON.parse(plaintext.toString());
  } catch (error) {
    throw new Error('ERROR WITH DECRYPTING JWE');
  }
};

module.exports = security;
