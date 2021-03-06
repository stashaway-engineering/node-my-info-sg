@ECHO off
set DEMO_APP_SIGNATURE_CERT_PRIVATE_KEY=./ssl/stg-demoapp-client-privatekey-2018.pem
set MYINFO_SIGNATURE_CERT_PUBLIC_CERT=./ssl/stg-auth-signing-public.pem

set MYINFO_APP_CLIENT_ID=STG2-MYINFO-SELF-TEST
set MYINFO_APP_CLIENT_SECRET=44d953c796cccebcec9bdc826852857ab412fbe2
set MYINFO_APP_REDIRECT_URL=http://localhost:3001/callback

rem SANDBOX ENVIRONMENT (no PKI digital signature)
set AUTH_LEVEL=L0
set MYINFO_API_BASE_URL=https://sandbox.api.myinfo.gov.sg

rem TEST ENVIRONMENT (with PKI digital signature)
rem set AUTH_LEVEL=L2
rem set MYINFO_API_BASE_URL=https://test.api.myinfo.gov.sg

npm start
                                                                                                                                                                                                                                                           
