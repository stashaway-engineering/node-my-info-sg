# node-my-info-sg 🇸🇬

[![npm version](https://badge.fury.io/js/node-my-info-sg.svg)](https://badge.fury.io/js/node-my-info-sg) [![CircleCI](https://circleci.com/gh/stashaway-engineering/node-my-info-sg.svg?style=svg)](https://circleci.com/gh/stashaway-engineering/node-my-info-sg)

Small wrapper around Singapore [MyInfo V3 API](https://www.ndi-api.gov.sg/library/trusted-data/myinfo/introduction) for node JS. Wraps the scary-scary 😱 security logic into easy to use APIs. 

Lightly refactored from the [excellent official example](https://github.com/ndi-trusted-data/myinfo-demo-app) 🎉

## Usage

1. **Initialise MyInfoClient**

	```js
	const MyInfoClient = require('node-my-info-sg');

	const myInfoClient = new MyInfoClient({
	  // MyInfo API base URL (sandbox/test/production)
	  // https://www.ndi-api.gov.sg/assets/lib/trusted-data/myinfo/specs/myinfo-kyc-v3.0.1.yaml.html#section/Environments/Available-Environments
	  baseUrl: 'https://sandbox.api.myinfo.gov.sg',
	  
	  // Api auth level (L0 for sandbox; Otherwise L2)
	  authLevel: 'L0',
	  
	  // Public key from MyInfo Consent Platform given to you during onboarding for RSA digital signature
	  publicCertPath: './ssl/stg-auth-signing-public.pem',
	  
	  // Your private key for RSA digital signature
	  privateKeyPath: './ssl/stg-demoapp-client-privatekey-2018.pem',
	  
	  // Your client_id provided to you during onboarding
	  clientId: 'STG2-MYINFO-SELF-TEST',
	  
	  // Your client_secret provided to you during onboarding
	  clientSecret: '44d953c796cccebcec9bdc826852857ab412fbe2',
	  
	  // Redirect URL for your web application
	  // https://www.ndi-api.gov.sg/library/trusted-data/myinfo/implementation-technical-requirements (Callback URLs)
	  redirectUrl: 'http://localhost:3001/callback',
	});
	```

1. **Generate the OAuth2 url**
	
	```js
	const attributes = ['uinfin', 'name', 'mobileno'];
	const { authoriseUrl, state } = myInfoClient.getAuthoriseUrl(purpose, attributes);
	// Then you can pass authoriseUrl to your frontend app
	// (or open authoriseUrl on a WebView on your mobile apps)
	//
	// Note: You might want to store authoriseUrl, attributes, and state to fulfill the transaction log requirements
	// https://www.ndi-api.gov.sg/library/trusted-data/myinfo/implementation-technical-requirements
	```

1. **Get the person object**

	```js	
	// Exchange authorisation code with usable access token
	const { accessToken } = await myInfoClient.getToken(code);
	  
	// Get the person object
	// Make sure attributes is the same as the one requested in previous step!
	const { person } = await myInfoClient.getPerson(accessToken, attributes)
	  
	// Now you can return the person object to your frontend and pre-fill your form!
	console.log(JSON.stringify(person)); 
	```

## Example
	
In the example directory, run:

```js
yarn install
./start.sh
```
  
	
## Unit test
	
```js
yarn lint
yarn test
```
