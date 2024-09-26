/* eslint no-await-in-loop: 0, no-sync: 0, no-use-before-define: 0 */

/**
 * Common playwright fixtures and utilities.
 *
 * - Setup API recording and mocking
 * - Collect Coverage
 */

require('dotenv').config({
  path: ['.env']
});

const base = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');


const URL_REGX = new RegExp(
  '(' +
    [
      process.env.NEXT_PUBLIC_API_URL,
      // also record all api routes, except test preview mode.
      process.env.NEXT_PUBLIC_EMBED_ORIGIN + '/api/(?!test-preview-mode/)'
    ]
      .filter((x) => !!x)
      .join(')|(') +
    ')'
);
exports.URL_REGX = URL_REGX;

function generateUUID() {
  return crypto.randomBytes(16).toString('hex');
}

const { COVERAGE, RECORD } = process.env;
const useCoverage = COVERAGE === 'true';
const istanbulTempDir = path.join(process.cwd(), 'coverage-e2e/tmp');
const baseRecordingDir = path.join(__dirname, './api-recordings');

async function getIsAPIRecording(info, browser) {
  const recordingDir = path.join(baseRecordingDir, info.titlePath[0]);

  const baseRecordingName =
    info.titlePath
      .slice(1)
      .join('_')
      .replace(/[\s/]/g, '_')
      .replace(/(\.spec)?\.js/, '')
      .toLowerCase() +
    '.har';

  // Recordings are prefixed with the line number for convenience when finding them.
  let recordingName = info.line + '_' + baseRecordingName;
  let recordingPath = path.join(recordingDir, recordingName);
  let fileExists = await (async () => {
    try {
      await fs.promises.access(recordingPath);
      return true;
    } catch {
      return false;
    }
  })();

  // Since line numbers change often, merge with any existing recordings with the same name.
  try {
    let existingRecordings = await fs.promises.readdir(recordingDir);
    existingRecordings = existingRecordings.filter(
      (x) => x.indexOf(baseRecordingName) > -1
    );
    for (const rec of existingRecordings) {
      if (rec === recordingName) continue; // eslint-disable-line no-continue
      if (RECORD === 'true') {
        // If recording update the file name
        if (!fileExists) {
          await fs.promises.rename(path.join(recordingDir, rec), recordingPath);
          fileExists = true;
        } else {
          // remove duplicate recordings
          await fs.promises.unlink(path.join(recordingDir, rec));
        }
      } else {
        // If not recording use the old file name (assume a change was made that does not require updating recording)
        recordingName = rec;
        recordingPath = path.join(recordingDir, rec);
        fileExists = true;
        break;
      }
    }
  } catch (err) {
    // ignore
  }

  if (RECORD !== 'true') {
    return { isRecording: false, recordingPath, fileExists };
  }

  return { isRecording: !fileExists, recordingPath, fileExists };
}

exports.test = base.test.extend({
  context: async ({ browser }, use) => {
    // Setup recording. If the recording already exists, use it.
    const contextOptions = {};
    const info = base.test.info();

    const { isRecording, recordingPath, fileExists } = await getIsAPIRecording(
      info,
      browser
    );

    if (isRecording) {
      contextOptions.recordHar = {
        path: recordingPath,
        mode: 'minimal',
        urlFilter: URL_REGX
      };
    }

    const context = await browser.newContext(contextOptions);
    if (!isRecording && fileExists) {
      await context.routeFromHAR(recordingPath, {
        url: URL_REGX
      });
    } else if (!isRecording) {
      // just abort any other requests if there is no recording
      await context.route(URL_REGX, (route) => {
        route.abort();
      });
    }

    // S3 response mock (HAR recording is buggy with this)
    await context.route(/s3\..*/, (route, req) => {
      if (req.method() === 'GET') {
        return route.fulfill({
          status: 200,
          body: 'abcde'
        });
      }
      return route.fulfill({
        status: 204
      });
    });

    // setup coverage
    if (useCoverage) {
      await context.addInitScript(() =>
        window.addEventListener('beforeunload', () =>
          window.collectIstanbulCoverage(JSON.stringify(window.__coverage__))
        )
      );
      await fs.promises.mkdir(istanbulTempDir, { recursive: true });
      await context.exposeFunction(
        'collectIstanbulCoverage',
        (coverageJSON) => {
          if (coverageJSON)
            fs.promises.writeFile(
              path.join(
                istanbulTempDir,
                `playwright_coverage_${generateUUID()}.json`
              ),
              coverageJSON
            );
        }
      );
    }

    await use(context);

    // clean up coverage
    if (useCoverage) {
      for (const page of context.pages()) {
        // eslint-disable-next-line no-await-in-loop
        await page.evaluate(() =>
          window.collectIstanbulCoverage(JSON.stringify(window.__coverage__))
        );
      }
    }

    await context.close();

    // post process HAR recordings
    if (isRecording) {
      const infoAgain = base.test.info();
      // Clean if failed
      if (infoAgain.status === 'failed') {
        try {
          await fs.promises.unlink(recordingPath);
        } catch (err) {
          logger.error('Error while cleaning up playwright recordings.');
          logger.error(err);
        }
      } else {
        removeAborted(recordingPath); // eslint-disable-line no-use-before-define
      }
    }
  },

  page: async ({ page }, use, testInfo) => {
    // Setup recording for server side rendering (getStaticProps)

    const testName = testInfo.titlePath
      .slice(1)
      .join('_')
      .replace(/[\s/]/g, '_')
      .replace(/(\.spec)?\.js/, '')
      .toLowerCase();
    const baseDir = testInfo.titlePath[0];

    // Set the current test name as a cookie
    await page.context().addCookies([
      {
        name: 'testInfo',
        value: JSON.stringify({ testName, baseDir }),
        domain: 'localhost',
        path: '/',
        httpOnly: false
      }
    ]);

    // Enable preview mode to allow mocking in getStaticProps
    await page.goto(`/api/test-preview-mode`);

    await use(page);
  },

});

function removeAborted(harFilePath) {
  // Read the existing HAR file
  const har = JSON.parse(fs.readFileSync(harFilePath, 'utf8'));

  // Filter out entries with errors like `net::ERR_ABORTED`
  const filteredEntries = har.log.entries.filter((entry) => {
    // Check if the request failed due to "net::ERR_ABORTED"
    return !(
      entry.response._failureText &&
      entry.response._failureText === 'net::ERR_ABORTED'
    );
  });

  // eslint-disable-next-line no-console
  console.warn(`Ignoring ${filteredEntries.length} aborted network requests`);

  // Replace the original entries with the filtered ones
  har.log.entries = filteredEntries;

  // Write the cleaned HAR back to the original file
  fs.writeFileSync(harFilePath, JSON.stringify(har, null, 2));
}

exports.expect = base.expect;
