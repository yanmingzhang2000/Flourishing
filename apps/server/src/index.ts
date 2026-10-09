import { createApp } from './app';
import { config, DEV_JWT_SECRET } from './config';

if (config.isProduction && config.jwtSecret === DEV_JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production');
}

const app = createApp();

app.listen(config.port, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'server_started',
      port: config.port,
      env: config.nodeEnv,
    }),
  );
});
