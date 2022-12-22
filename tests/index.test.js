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

async function runMockpassOAuthFlow(page, authoriseUrl, callbackUrl) {
  // Visit authoriseUrl login with the second user on the dropdown
  await page.goto(authoriseUrl);

  await page.waitFor('[name="code"]');
  await page.evaluate(() => { document.querySelector('[name="code"]').selectedIndex = 2; });

  await page.click('button.btn-danger');

  // Wait until allow permission button is visible
  await page.waitFor('button#allow');

  // Click on allow permission and wait for redirection to callbackUrl
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
  overrideRedirectUrl,
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

  const actualRedirectUrl = overrideRedirectUrl || redirectUrl;

  const { authoriseUrl, state } = client.getAuthoriseUrl(purpose, attributes, overrideRedirectUrl);
  // client.getAuthoriseUrl should construct a authoriseUrl

  expect(authoriseUrl).toEqual(`\
${baseUrl}/com/v3/authorise?client_id=${clientId}\
&attributes=${attributes.join(',')}\
&purpose=${purpose}\
&state=${state}\
&redirect_uri=${actualRedirectUrl}`);

  const { code } = await runMockpassOAuthFlow(page, authoriseUrl, actualRedirectUrl);
  // OAuth flow should returns an authorization_code
  expect(typeof code).toEqual('string');

  const { accessToken } = await client.getToken(code, overrideRedirectUrl);
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

  beforeAll(async () => {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  beforeEach(async () => { page = await browser.newPage(); });
  afterAll(async () => { await browser.close(); });

  describe('on sandbox environment (no PKI digital signature)', () => {
    const baseParams = {
      purpose: ' signing up with MyInfo',
      attributes: ['uinfin', 'name', 'mobileno'],
      baseUrl: 'https://sandbox.api.myinfo.gov.sg',
      authLevel: 'L0',
      publicCertPath: './example/ssl/stg-auth-signing-public.pem',
      privateKeyPath: './example/ssl/stg-demoapp-client-privatekey-2018.pem',
      clientId: 'STG2-MYINFO-SELF-TEST',
      clientSecret: '44d953c796cccebcec9bdc826852857ab412fbe2',
      redirectUrl: 'http://localhost:3001/callback',
    };

    it('handles the full MyInfo flow', () => {
      return testFullMyInfoFlow({ ...baseParams, page });
    });

    it('handles the full MyInfo flow with when overriding the redirectUrl', () => {
      return testFullMyInfoFlow({
        ...baseParams,
        page,
        overrideRedirectUrl: 'http://localhost:3001/callback',
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
