import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDescription } from '../js/intake.js';

test('reads a Hebrew building description', () => {
  const { patch, found } = parseDescription('מלון של 10 קומות עם 30 חדרים בכל קומה, מרתף, 6 מצלמות בקומה, אינטרנט 2 גיגה, שני ספקים');
  assert.equal(patch.profile, 'hotel');
  assert.equal(patch.buildings[0].floors, 10);
  assert.equal(patch.buildings[0].roomsPerFloor, 30);
  assert.equal(patch.buildings[0].firstFloor, -1);
  assert.equal(patch.camerasPerFloor, 6);
  assert.equal(patch.wanMbps, 2000);
  assert.ok(found.length >= 5);
});

test('office with total rooms and no phones', () => {
  const { patch } = parseDescription('בניין משרדים 4 קומות, 120 חדרים, 2 נקודות בכל חדר, בלי טלפונים, 3 מבנים');
  assert.equal(patch.profile, 'office');
  assert.equal(patch.buildings.length, 3);
  assert.equal(patch.buildings[0].roomsPerFloor, 30);
  assert.equal(patch.perRoom.data, 2);
  assert.equal(patch.perRoom.voice, 0);
});
