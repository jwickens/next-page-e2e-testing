import path from 'path';
import fs from 'fs';

const { NODE_ENV, RECORD } = process.env;

const recordingsDir = path.join(process.cwd(), 'test', 'api-recordings');

export default function wrapStaticPropsForTests(getStaticPropsFn) {
  if (NODE_ENV === 'production') {
    return getStaticPropsFn;
  }

  return async function getStaticProps(context) {
    if (!context.preview) {
      return getStaticPropsFn(context);
    }
    const nock = require('nock'); // eslint-disable-line global-require
    const { testName, baseDir } = context.previewData;
    const fixtureDir = path.join(recordingsDir, baseDir, 'server');
    const fixturePath = path.join(fixtureDir, `${testName}.json`);
    nock.cleanAll();
    if (!nock.isActive()) {
      nock.activate();
    } else {
      nock.restore();
      nock.activate();
    }

    // If RECORD is true, start recording and save the network interactions
    let isRecording = false;

    if (fs.existsSync(fixturePath)) {
      const nockDefs = nock.loadDefs(fixturePath);
      const nocks = nock.define(nockDefs.map(compressBody));
      console.log(
        `Using server api recording for ${testName} (${nocks.length} mocks)`
      );
    } else if (RECORD === 'true') {
      try {
        nock.recorder.rec({
          output_objects: true,
          dont_print: true
        });
        isRecording = true;
        console.log(`Recording started for ${testName}`);
      } catch (err) {
        console.log(`Could not start recording for ${testName}`);
      }
    } else {
      console.warn(`No server API recording found for ${testName}.`);
    }

    try {
      const result = await getStaticPropsFn(context);

      if (RECORD === 'true' && isRecording) {
        const nockCallObjects = nock.recorder.play();
        if (!fs.existsSync(fixtureDir)) {
          fs.mkdirSync(fixtureDir, { recursive: true });
        }
        const decompressedNockCalls = nockCallObjects.map(decompressBody);
        fs.writeFileSync(
          fixturePath,
          JSON.stringify(decompressedNockCalls, null, 2)
        );
        console.log(
          `Recording ended for ${testName} (saved ${nockCallObjects.length} recordings)`
        );
        nock.recorder.clear();
      }

      return result;
    } finally {
      nock.cleanAll();
      nock.restore();
    }
  };
}

function decompressBody(nockDef) {
    const response = nockDef.response.map((response) => {
      if (typeof response !== 'string') {
        return response;
      }
      try {
        const buffer = Buffer.from(response, 'hex');
        return JSON.parse(buffer.toString('utf-8'));
      } catch (err) {
        console.error('Failed to decompress body:', err);
        return response;
      }
    });
    return {
      ...nockDef,
      response,
    }
}

function compressBody(nockDef) {
  const response = nockDef.response.map((response) => {
    try {
      const buffer = Buffer.from(JSON.stringify(response), 'utf-8');
      return buffer.toString('hex');
    } catch (err) {
      console.error('Failed to compress body:', err);
      return response;
    }
  });
  return {
    ...nockDef,
    response
  };
}