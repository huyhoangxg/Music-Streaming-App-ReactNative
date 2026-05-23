import crypto from 'crypto';
import {
  MetadataProviderInput,
  MetadataProviderResult,
} from './metadata.types';

const ACRCLOUD_HOST = process.env.ACRCLOUD_HOST || '';
const ACRCLOUD_ACCESS_KEY = process.env.ACRCLOUD_ACCESS_KEY || '';
const ACRCLOUD_ACCESS_SECRET = process.env.ACRCLOUD_ACCESS_SECRET || '';

export interface MetadataProvider {
  recognize(input: MetadataProviderInput): Promise<MetadataProviderResult>;
}

function buildSignature() {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToSign = ['POST', '/v1/identify', ACRCLOUD_ACCESS_KEY, 'audio', '1', timestamp].join('\n');
  const signature = crypto
    .createHmac('sha1', ACRCLOUD_ACCESS_SECRET)
    .update(stringToSign)
    .digest('base64');

  return { signature, timestamp };
}

class AcrCloudMetadataProvider implements MetadataProvider {
  async recognize(input: MetadataProviderInput): Promise<MetadataProviderResult> {
    if (!ACRCLOUD_HOST || !ACRCLOUD_ACCESS_KEY || !ACRCLOUD_ACCESS_SECRET) {
      return {
        status: 'unmatched',
        source: 'acrcloud',
        genres: [],
      };
    }

    const { signature, timestamp } = buildSignature();

    // Real ACRCloud integration should:
    // 1. download a short audio sample from Cloudinary
    // 2. send multipart/form-data to the identify endpoint
    // 3. map provider metadata into the normalized result below
    // This scaffold keeps the signing contract visible without forcing network access.
    void signature;
    void timestamp;
    void input;

    return {
      status: 'unmatched',
      source: 'acrcloud',
      genres: [],
    };
  }
}

export const metadataProvider = new AcrCloudMetadataProvider();
