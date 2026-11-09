// שרת אפליקציית פריים אירועים ב-Cloudflare Workers. נפרס אוטומטית מ-GitHub
// (.github/workflows/events-hub-deploy.yml) בכל שינוי ב-events-hub/.
// כל הבקשות עוברות ל-Durable Object אחד ("main") שמחזיק את הנתונים ב-SQLite, כמו שרת הכניסה הקיים.
import { DurableObject } from 'cloudflare:workers';
import { configure } from './config.js';
import db from './db.js';
import { doStore } from './store-do.js';
import { seedIfEmpty } from './seed.js';
import { handle } from './app.js';
import config from './config.js';

export class EventsState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    configure(env);
    ctx.blockConcurrencyWhile(async () => {
      await db.init(doStore(ctx.storage.sql));
      seedIfEmpty();
    });
  }

  async fetch(request) {
    const res = await handle(request);
    if (res) return res;
    // כתובת השרת עצמה: מעבירים לאתר האפליקציה
    return Response.redirect(`${config.pagesUrl}/`, 302);
  }
}

export default {
  async fetch(request, env) {
    const stub = env.STATE.get(env.STATE.idFromName('main'));
    return stub.fetch(request);
  },
};
