// Several independent projects (new installation plans and live systems), kept in localStorage.

export const STATUSES = {
  plan: 'תכנון',
  install: 'בהתקנה',
  live: 'מערכת פעילה',
};

const KEY = 'driveplan.projects';
const OLD_KEY = 'driveplan.cfg';

const uid = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function newProject(cfg, { name, status = 'plan' } = {}) {
  const now = new Date().toISOString();
  return { id: uid(), name: name || cfg.site?.name || 'פרויקט חדש', status, created: now, updated: now, cfg, install: {}, log: [] };
}

export function loadProjects(store, makeDefault, migrate) {
  const data = store.get(KEY, null);
  if (data?.list?.length) {
    data.list = data.list.map((p) => ({ install: {}, log: [], status: 'plan', ...p, cfg: migrate(p.cfg) || makeDefault() }));
    if (!data.list.some((p) => p.id === data.active)) data.active = data.list[0].id;
    return data;
  }
  // first run, or upgrade from the single-plan version
  const old = migrate(store.get(OLD_KEY, null));
  const p = newProject(old || makeDefault(), { status: old ? 'live' : 'plan' });
  return { active: p.id, list: [p] };
}

export function saveProjects(store, data) {
  return store.set(KEY, data);
}

export function logChange(project, text) {
  project.log = project.log || [];
  project.log.unshift({ ts: new Date().toISOString(), text });
  if (project.log.length > 500) project.log.length = 500;
}
