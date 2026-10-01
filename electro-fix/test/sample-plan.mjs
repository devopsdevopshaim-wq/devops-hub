// שרטוט הדוגמה נמצא ב-js/plansample.js (משמש גם את כפתור "דוגמה" באתר).
import { createRequire } from 'node:module';
const PlanSample = createRequire(import.meta.url)('../js/plansample.js');
export const sampleProject = PlanSample.sampleProject;
export const sampleSvg = PlanSample.sampleSvg;
