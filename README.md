This is a demo of how to use E2E testing with playwright with complete mocking (via recording) of external requests made both server side and client side.

## Getting Started

Install the project dependencies as well as playwright browsers

```bash
npm i
npx playwright install
```

Run the development server. Next recommends running against production however to record coverage its necessary to use a development build, and in addition the recording and playback setup shown here is turned off for production.

```bash
npm run dev
```

Then you can run playwright tests with:

```bash
npx playwright test
```

Test external requests are not being made by:
1. Turning off your network connection OR
2. Setting RECORD=false in .env


## How it works

### Client side recording

Client side recording uses the built in playwright functionality. In [test/playwright.js](test/playwright.js) we set it up so that each recording is isolated to each individual test. 

### Server side recording

We use `nock` to record requests made by the server in `getStaticProps`. This is done with a wrapper [test/helpers/wrap-static-props-for-tests.js](test/helpers/wrap-static-props-for-tests.js) that uses [preview mode](https://nextjs.org/docs/pages/building-your-application/configuring/preview-mode) in order to get the test name to assign recordings to.

## Issues

### Nock Related

#### Nock does not reliably intercept on server start.

1. Delete `test/helpers/wrap-static-props-for-tests.js`
2. Make sure you can connect to the internet and that RECORD=true
3. Start the development server.
4. Run the tests with playwright `npx playwright test`

In the logs where you ran npm run dev, you should see "Recording ended for home_page_can_view_the_page (saved 0 recordings)"

Now delete `test/helpers/wrap-static-props-for-tests.js` again.

Without restarting the server rerun the test.

You should see "Recording ended for home_page_can_view_the_page (saved 1 recordings)"

#### Nock returns response in Base64

I'm not sure if this is by design but nock recording is returning the body in base64. See the compress/decompress utils added here: `test/helpers/wrap-static-props-for-tests.js`. IMO Nock should be returning json bodies as objects.

### Vercel Related

#### Preview Mode is Deprecated

Preview mode is deprecated in favor of draft mode. Draft mode however has no "previewData" which we need in order to be able to pass test names to `test/helpers/wrap-static-props-for-tests.js`

As far as I can see there is no other way to pass information at runtime to `getStaticProps`.