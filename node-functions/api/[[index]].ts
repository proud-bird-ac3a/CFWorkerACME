import {app} from '../../src';
import {serveStatic} from '@hono/node-server/serve-static';

// app.use("*", serveStatic({root: "./public"}));

export default app;