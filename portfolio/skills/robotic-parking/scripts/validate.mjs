// Static checks for a robotic-parking site. Usage: node validate.mjs <site-dir>
import fs from "fs"; import path from "path"; import vm from "vm";
const dir = process.argv[2]; if (!dir) { console.error("usage: validate.mjs <site-dir>"); process.exit(2); }
let err = 0, warn = 0; const E = m => { console.log("ERROR " + m); err++; }, W = m => { console.log("WARN  " + m); warn++; };
const read = f => { try { return fs.readFileSync(path.join(dir, f), "utf8"); } catch { return null; } };
const app = read("app.html"), idx = read("index.html");
if (!app) E("app.html missing"); if (!idx) E("index.html missing (run build.sh)");
if (app && idx && !idx.includes(app.slice(app.indexOf("<script>"), app.indexOf("<script>") + 2000))) W("index.html looks older than app.html; run build.sh");
if (app) {
  const js = app.slice(app.indexOf("<script>") + 8, app.lastIndexOf("</script>"));
  try { new vm.Script(js); } catch (e) { E("script does not parse: " + e.message); }
  if (!/<title>[^<]{2,60}<\/title>/.test(app.slice(0, 8000))) E("missing <title> in the first 8KB");
  const wa = (app.match(/https:\/\/wa\.me\/(\d+)/) || [])[1]; if (!wa) W("no WhatsApp contact link"); else if (!/^9725\d{8}$/.test(wa)) W("WhatsApp number is not an Israeli mobile in 972… form: " + wa);
  const repo = (app.match(/repo:"([^"]+)",dir:"([^"]+)"/) || []); if (!repo[1]) E("gallery repo/dir not set"); else console.log(`OK    gallery publishes to ${repo[1]}/${repo[2]}`);
  for (const m of app.matchAll(/(?:url\(|src=")(img\/[\w.-]+)/g)) if (!fs.existsSync(path.join(dir, m[1]))) E("missing image " + m[1]);
  for (const id of ["tower", "shuttle", "twin", "under"]) if (!fs.existsSync(path.join(dir, `img/type-${id === "under" ? "under" : id}.jpg`))) W(`missing example image img/type-${id}.jpg`);
  if (/lorem ipsum/i.test(app)) W("placeholder text found");
}
const g = read("gallery/gallery.json");
if (g) { try { const a = JSON.parse(g); if (!Array.isArray(a)) E("gallery.json must be an array"); a.forEach((x, i) => { const f = x.file ? "gallery/" + x.file : x.url; if (!f) E(`gallery item ${i} has no file/url`); else if (!/^https?:/.test(f) && !fs.existsSync(path.join(dir, f))) E(`gallery item ${i}: ${f} missing`); if (!x.title) W(`gallery item ${i} has no title`); }); } catch (e) { E("gallery.json: " + e.message); } }
else W("gallery/gallery.json missing (gallery starts empty)");
console.log(`\n${err} error(s), ${warn} warning(s)`); process.exit(err ? 1 : 0);
