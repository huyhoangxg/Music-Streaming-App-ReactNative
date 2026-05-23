import { env } from './config/env';
import app from './app';

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
  if (!env.EMAIL_PROVIDER_CONFIGURED) {
    console.warn(
      'Email verification is not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS or RESEND_API_KEY/EMAIL_FROM in streaming-app-backend/.env.',
    );
  }
});
