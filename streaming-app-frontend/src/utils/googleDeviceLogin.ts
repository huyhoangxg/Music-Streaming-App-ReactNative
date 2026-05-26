import axios from 'axios';

type GoogleDevicePrompt = {
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
};

type GoogleDeviceStartResponse = GoogleDevicePrompt & {
  sessionId: string;
  interval?: number;
};

const sleep = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export async function runGoogleDeviceLogin(
  apiUrl: string,
  onPrompt: (prompt: GoogleDevicePrompt) => void,
) {
  const startResponse = await axios.post<GoogleDeviceStartResponse>(
    `${apiUrl}/api/auth/google/device/start`,
  );
  const start = startResponse.data;

  onPrompt({
    userCode: start.userCode,
    verificationUrl: start.verificationUrl,
    expiresIn: start.expiresIn,
  });

  const deadline = Date.now() + Math.max(60, start.expiresIn || 1800) * 1000;
  let retryAfterSeconds = Math.max(3, start.interval || 5);

  while (Date.now() < deadline) {
    await sleep(retryAfterSeconds * 1000);

    const pollResponse = await axios.post(
      `${apiUrl}/api/auth/google/device/poll`,
      { sessionId: start.sessionId },
      {
        validateStatus: (status) => status === 200 || status === 202,
      },
    );

    if (pollResponse.status === 200 && pollResponse.data?.token) {
      return pollResponse.data.token as string;
    }

    retryAfterSeconds = Math.max(
      3,
      Number(pollResponse.data?.retryAfterSeconds) || retryAfterSeconds,
    );
  }

  throw new Error('Google verification expired. Please try again.');
}
