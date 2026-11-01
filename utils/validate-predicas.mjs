#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { services, sundaySlots } from './predicas-slots.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.join('=')];
}));
const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const month = (args.month || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const year = Number(args.year);
const monthIndex = months.indexOf(month) + 1;
if (!Number.isInteger(year) || !monthIndex) {
  console.error('Usage: npm run validate:predicas -- --year=2026 --month=octubre');
  process.exit(2);
}
const file = path.join(root, 'src', 'data', 'predicas', String(year), `predicas_${year}.json`);
const all = JSON.parse(fs.readFileSync(file, 'utf8'));
const record = all.find((entry) => entry.month.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === month);
if (!record) throw Error(`No sermon month found: ${month} ${year}`);
const slots = sundaySlots(year, monthIndex);
const counts = new Map(slots.map(({ date, service }) => [`${date}|${service}`, 0]));
const issues = [];
const withoutVideo = [];
for (const entry of record.data) {
  const key = `${entry.date}|${entry.service}`;
  if (!services.includes(entry.service)) issues.push(`Invalid service for ${entry.title}: ${entry.service || 'missing'}`);
  else if (!counts.has(key)) issues.push(`Unexpected date/service: ${key}`);
  else counts.set(key, counts.get(key) + 1);
  if (!entry.pdf_url) issues.push(`Missing PDF: ${key}`);
  if (!entry.youtube_url) withoutVideo.push(key);
}
for (const [key, count] of counts) {
  if (count !== 1) issues.push(`${key}: expected 1 entry, found ${count}`);
}
console.log(`${month} ${year}: ${record.data.length}/${slots.length} Sunday service entries`);
if (withoutVideo.length) console.warn(`YouTube link pending: ${withoutVideo.join(', ')}`);
if (issues.length) {
  for (const issue of issues) console.error(issue);
  process.exitCode = 1;
} else console.log('Every Sunday has one entry for 7:00, 9:00, and 11:00 am.');
