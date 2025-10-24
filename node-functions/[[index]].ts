import {app} from '../src/index';
import {serveStatic} from '@hono/node-server/serve-static';

app.use("*", serveStatic({root: "./public"}));

export default app;