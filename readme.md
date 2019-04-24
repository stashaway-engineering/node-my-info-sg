# node-my-info-sg 🇸🇬


Small wrapper around Singapore [MyInfo V3 API](https://www.ndi-api.gov.sg/library/trusted-data/myinfo/introduction) for node JS. Wraps the scary-scary 😱 security logic into easy to use APIs

Lightly refactored from the [excellent official example](https://github.com/ndi-trusted-data/myinfo-demo-app) 🎉

## Usage

1. **Initialise MyInfoClient**

	```js
	const MyInfoClient = require('my-info-sg');

	const myInfoClient = new MyInfoClient({
	  // MyInfo API base URL (sandbox/test/production)
	  // https://www.ndi-api.gov.sg/assets/lib/trusted-data/myinfo/specs/myinfo-kyc-v3.0.1.yaml.html#section/Environments/Available-Environments
	  baseUrl: 'https://sandbox.api.myinfo.gov.sg',
	  
	  // Api auth level (L0 for sandbox; Otherwise L2)
	  authLevel: 'L0',
	  
	  // Public key from MyInfo Consent Platform given to you during onboarding for RSA digital signature
	  publicCertContent: './ssl/stg-auth-signing-public.pem',
	  
	  // Your private key for RSA digital signature
	  privateKeyContent: './ssl/stg-demoapp-client-privatekey-2018.pem',
	  
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
	var authoriseUrl = myInfoClient.getAuthoriseUrl(purpose, attributes);
	// Then pass this to the frontend, and redirect them 
	// (or open it on a webview for your mobile app)
	```

1. **Get the person object**

	```js
	myInfoClient.getToken(code) // Exchange authorisation code with usable access token
    .then((accessToken) => myInfoClient.getPerson(accessToken, _attributes)) // Get the person object
    .then((personData) => {
      console.log("Person Data:");
      console.log(JSON.stringify(personData))
    });
	```
	
## Example
	
In the example directory, run:

```js
yarn install
./start.sh
```

## Future Improvement

1. Add unit tests and sensible linting rules
1. Pass this repository to the cool government guy, so they can maintain it