import _ from 'lodash';
import qs from 'querystring';
import puppeteer from 'puppeteer';
import MyInfoClient from '../lib/client';

jest.setTimeout(30000);

function getQueryParamFromURL(url, key) {
  const queryStringMatcher = /(.*)\?(.*)/;

  if (!queryStringMatcher.test(url)) return null;
  const [, , queryString] = url.match(queryStringMatcher);
  const queryParams = qs.parse(queryString);
  return _.get(queryParams, key);
}

async function runSingpassMockOAuthFlow(page, url, callbackUrl) {
  await page.goto(url);
  await page.waitFor('#salutationCode');
  await page.evaluate(() => { document.getElementById('salutationCode').selectedIndex = 2; });
  await page.click('#accountBtn');

  await page.waitFor('button#allow');
  const [request] = await Promise.all([
    page.waitForRequest((_request) => _.startsWith(_request.url(), callbackUrl)),
    page.click('button#allow'),
  ]);
  const resultUrl = request.url();

  const state = getQueryParamFromURL(resultUrl, 'state');
  const code = getQueryParamFromURL(resultUrl, 'code');
  return { state, code };
}

async function testFullMyInfoFlow({
  page,
  purpose,
  attributes,
  baseUrl,
  authLevel,
  publicCertPath,
  privateKeyPath,
  clientId,
  clientSecret,
  redirectUrl,
}) {
  const client = new MyInfoClient({
    baseUrl,
    authLevel,
    publicCertPath,
    privateKeyPath,
    clientId,
    clientSecret,
    redirectUrl,
  });


  const { authoriseUrl, state } = client.getAuthoriseUrl(purpose, attributes);
  // client.getAuthoriseUrl should construct a authoriseUrl
  expect(authoriseUrl).toEqual(`\
${baseUrl}/com/v3/authorise?client_id=${clientId}\
&attributes=${attributes.join(',')}\
&purpose=${purpose}\
&state=${state}\
&redirect_uri=${redirectUrl}`);


  const { code } = await runSingpassMockOAuthFlow(page, authoriseUrl, redirectUrl);
  // Oauth flow should returns an authorization_code
  expect(typeof code).toEqual('string');

  const { accessToken } = await client.getToken(code);
  // client.getToken should returns an accessToken
  expect(typeof accessToken).toEqual('string');

  const { person } = await client.getPerson(accessToken, attributes);
  // client.getPerson should a person object with all requested properties
  for (let i = 0; i < attributes.length; i += 1) {
    expect(person).toHaveProperty(attributes[i]);
  }
}

describe('node-my-info-sg', () => {
  let browser;
  let page;

  beforeAll(async () => { browser = await puppeteer.launch(); });
  beforeEach(async () => { page = await browser.newPage(); });
  afterAll(async () => { await browser.close(); });

  describe('on sandbox environment (no PKI digital signature)', () => {
    it('handles the full MyInfo flow', () => {
      return testFullMyInfoFlow({
        page,
        purpose: ' signing up with MyInfo',
        attributes: ['uinfin', 'name', 'mobileno'],
        baseUrl: 'https://sandbox.api.myinfo.gov.sg',
        authLevel: 'L0',
        publicCertPath: './example/ssl/stg-auth-signing-public.pem',
        privateKeyPath: './example/ssl/stg-demoapp-client-privatekey-2018.pem',
        clientId: 'STG2-MYINFO-SELF-TEST',
        clientSecret: '44d953c796cccebcec9bdc826852857ab412fbe2',
        redirectUrl: 'http://localhost:3001/callback',
      });
    });
  });

  describe('on test environment (with PKI digital signature)', () => {
    it('handles the full MyInfo flow', () => {
      return testFullMyInfoFlow({
        page,
        purpose: ' signing up with MyInfo',
        attributes: ['uinfin', 'name', 'mobileno'],
        baseUrl: 'https://test.api.myinfo.gov.sg',
        authLevel: 'L2',
        publicCertPath: './example/ssl/stg-auth-signing-public.pem',
        privateKeyPath: './example/ssl/stg-demoapp-client-privatekey-2018.pem',
        clientId: 'STG2-MYINFO-SELF-TEST',
        clientSecret: '44d953c796cccebcec9bdc826852857ab412fbe2',
        redirectUrl: 'http://localhost:3001/callback',
      });
    });
  });
});
