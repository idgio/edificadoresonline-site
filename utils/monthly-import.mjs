#!/usr/bin/env node
// Prepare the source material for one monthly content update. Requires Node 20+.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sundaySlots, salvadorDate } from './predicas-slots.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=') || true];
}));
const normalize = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const slug = (s) => normalize(s).replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const month = normalize(args.month || '');
const action = normalize(args.action || '');
const year = Number(args.year || new Date().getFullYear());
if (!months.includes(month) || !['refugio','predicas'].includes(action) || !Number.isInteger(year) || year < 2020) {
  console.error('Usage: node utils/monthly-import.mjs --month=noviembre --action=refugio|predicas [--year=2026] [--doc="Descripción Web"] [--dry-run]');
  process.exit(2);
}
const env = Object.fromEntries((await fs.readFile(path.join(root, '.env'), 'utf8')).split(/\r?\n/)
  .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
  .map((line) => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
for (const name of ['drive_id','account_json','cloudR2AccessKey','cloudR2SecretKey','cloudR2Bucket','r2_s3_API_URL']) {
  if (!env[name]) throw Error(`Missing .env variable: ${name}`);
}
const dryRun = Boolean(args['dry-run']);
const output = path.join(root, '.monthly-import', String(year), month, action);
await fs.mkdir(output, { recursive: true });
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'monthly-import-'));
const google = JSON.parse(await fs.readFile(path.resolve(root, env.account_json), 'utf8'));
const base64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = base64({ alg: 'RS256', typ: 'JWT' }) + '.' + base64({ iss: google.client_email, scope: 'https://www.googleapis.com/auth/drive.readonly', aud: google.token_uri, iat: now, exp: now + 3600 });
const assertion = unsigned + '.' + crypto.sign('RSA-SHA256', Buffer.from(unsigned), google.private_key).toString('base64url');
const tokenResponse = await fetch(google.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
if (!tokenResponse.ok) throw Error(`Google OAuth failed: ${tokenResponse.status}`);
const driveToken = (await tokenResponse.json()).access_token;
async function driveList(folderId) {
  const files = []; let pageToken;
  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
    url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType)');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${driveToken}` } });
    if (!response.ok) throw Error(`Drive listing failed: ${response.status}`);
    const page = await response.json(); files.push(...page.files); pageToken = page.nextPageToken;
  } while (pageToken);
  return files;
}
function exactlyOne(files, predicate, label) {
  const matches = files.filter(predicate);
  if (matches.length !== 1) throw Error(`Expected one ${label}; found ${matches.length}: ${matches.map((f) => f.name).join(', ')}`);
  return matches[0];
}
async function driveDownload(file, destination, exportText = false) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}${exportText ? '/export' : ''}`);
  url.searchParams.set(exportText ? 'mimeType' : 'alt', exportText ? 'text/plain' : 'media');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${driveToken}` } });
  if (!response.ok) throw Error(`Drive download failed for ${file.name}: ${response.status}`);
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
}
function run(script, cwd) {
  const result = spawnSync('bash', [path.join(root, 'utils', script)], { cwd, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
  if (result.status !== 0) throw Error(`${script} failed: ${result.stderr || result.stdout}`);
}
function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function hmac(key, data) { return crypto.createHmac('sha256', key).update(data).digest(); }
async function r2Request(method, key, data) {
  const endpoint = new URL(env.r2_s3_API_URL.replace(/\/$/, ''));
  const objectPath = '/' + [env.cloudR2Bucket, ...key.split('/')].map(encodeURIComponent).join('/');
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = date.slice(0, 8); const hash = sha256(data ?? Buffer.alloc(0));
  const headers = `host:${endpoint.host}\nx-amz-content-sha256:${hash}\nx-amz-date:${date}\n`;
  const canonical = [method,objectPath,'',headers,'host;x-amz-content-sha256;x-amz-date',hash].join('\n');
  const scope = `${day}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256',date,scope,sha256(Buffer.from(canonical))].join('\n');
  const signing = hmac(hmac(hmac(hmac('AWS4' + env.cloudR2SecretKey, day), 'auto'), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signing).update(toSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${env.cloudR2AccessKey}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`;
  return fetch(endpoint.origin + objectPath, { method, headers: { Authorization: authorization, 'x-amz-date': date, 'x-amz-content-sha256': hash, ...(method === 'PUT' ? { 'content-type': 'application/pdf' } : {}) }, ...(data ? { body: data } : {}) });
}
async function r2Put(key, data) {
  if (dryRun) return 'prepared';
  const existing = await r2Request('HEAD', key);
  if (existing.ok) return 'reused';
  if (existing.status !== 404) throw Error(`R2 existence check failed for ${key}: ${existing.status}`);
  const response = await r2Request('PUT', key, data);
  if (!response.ok) throw Error(`R2 upload failed for ${key}: ${response.status} ${(await response.text()).match(/<Code>([^<]+)/)?.[1] || ''}`);
  return 'uploaded';
}
async function preparePdf(file, prefix, localPdf) {
  const work = await fs.mkdtemp(path.join(temp, 'pdf-'));
  const original = path.join(work, file.name.replace(/\.pptx$/i, '.pdf'));
  if (localPdf) await fs.copyFile(localPdf, original);
  else await driveDownload(file, original);
  run('compress-pdf.sh', work);
  const compressed = (await fs.readdir(path.join(work, 'out'))).find((f) => f.endsWith('.pdf'));
  if (!compressed) throw Error(`No compressed PDF for ${file.name}`);
  const bytes = await fs.readFile(path.join(work, 'out', compressed));
  const key = `${prefix}/${year}/${month}/${compressed}`;
  const uploadStatus = await r2Put(key, bytes);
  const textPath = path.join(output, `${slug(file.name)}.txt`);
  const extracted = spawnSync('gs', ['-q','-sDEVICE=txtwrite','-o','-',original], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (extracted.status === 0) await fs.writeFile(textPath, extracted.stdout);
  console.log(`${uploadStatus === 'reused' ? 'Reused' : uploadStatus === 'prepared' ? 'Prepared' : 'Uploaded'} ${key} (${bytes.length} bytes)`);
  return { sourceName: file.name, url: `${(env.R2_PUBLIC_URL || 'https://downloads.edificadoresonline.com').replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`, textPath: path.relative(root, textPath), bytes: bytes.length, uploadStatus };
}
async function preparePresentation(file) {
  const work = await fs.mkdtemp(path.join(temp, 'slides-'));
  const source = path.join(work, file.name);
  const converted = path.join(work, file.name.replace(/\.pptx$/i, '.pdf'));
  await driveDownload(file, source);
  const office = spawnSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', work, source], { encoding: 'utf8' });
  if (office.error?.code === 'ENOENT' && process.platform === 'darwin') {
    const script = ['on run argv', 'set sourceFile to POSIX file (item 1 of argv)', 'set targetFile to POSIX file (item 2 of argv)',
      'tell application "Keynote"', 'set deck to open sourceFile', 'export deck to targetFile as PDF', 'close deck saving no', 'end tell', 'end run'];
    const result = spawnSync('osascript', script.flatMap((line) => ['-e', line]).concat(source, converted), { encoding: 'utf8' });
    if (result.status !== 0) throw Error(`Keynote conversion failed: ${result.stderr || result.error?.message}`);
  } else if (office.status !== 0) throw Error(`LibreOffice conversion failed: ${office.stderr || office.error?.message}`);
  await fs.access(converted);
  return preparePdf(file, 'predicas', converted);
}
async function preparePredicaImage(file, service) {
  const imageWork = await fs.mkdtemp(path.join(temp, 'predica-image-'));
  await driveDownload(file, path.join(imageWork, file.name));
  let converted;
  if (file.mimeType === 'image/webp') converted = path.join(imageWork, file.name);
  else {
    run('convert-images.sh', imageWork);
    const name = (await fs.readdir(path.join(imageWork, 'out'))).find((f) => f.endsWith('.webp'));
    if (!name) throw Error(`No converted image for ${file.name}`);
    converted = path.join(imageWork, 'out', name);
  }
  const filename = `${slug(service)}-${slug(file.name)}.webp`;
  const destination = path.join(root, 'public', 'images', 'predicas', String(year), month, filename);
  if (!dryRun) { await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.copyFile(converted, destination); }
  return { sourceName: file.name, service, imageUrl: 'public/' + path.relative(path.join(root, 'public'), destination).split(path.sep).join('/') };
}
async function youtubeUploads() {
  if (!env.youtube_api_key || !env.youtube_channel) return [];
  const request = async (endpoint, params) => {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    for (const [key, value] of Object.entries({ ...params, key: env.youtube_api_key })) url.searchParams.set(key, value);
    const response = await fetch(url); if (!response.ok) throw Error(`YouTube ${endpoint} failed: ${response.status}`);
    return response.json();
  };
  const handle = env.youtube_channel.replace(/^@/, '').split('/')[0];
  const channel = (await request('channels', { part: 'contentDetails', forHandle: handle })).items?.[0];
  if (!channel) throw Error(`YouTube channel not found: ${handle}`);
  const playlist = channel.contentDetails.relatedPlaylists.uploads;
  const videos = []; let pageToken;
  do {
    const page = await request('playlistItems', { part: 'snippet,contentDetails', playlistId: playlist, maxResults: '50', ...(pageToken ? { pageToken } : {}) });
    videos.push(...(page.items || []).map((item) => ({ title: item.snippet.title, publishedAt: item.contentDetails.videoPublishedAt || item.snippet.publishedAt, url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}` })));
    pageToken = page.nextPageToken;
    if (videos.length >= 200) break;
  } while (pageToken);
  const details = [];
  for (let i = 0; i < videos.length; i += 50) {
    const ids = videos.slice(i, i + 50).map((video) => new URL(video.url).searchParams.get('v'));
    const page = await request('videos', { part: 'liveStreamingDetails,contentDetails', id: ids.join(',') });
    details.push(...(page.items || []));
  }
  const byId = new Map(details.map((item) => [item.id, item]));
  return videos.map((video) => {
    const item = byId.get(new URL(video.url).searchParams.get('v'));
    return { ...video, actualStartTime: item?.liveStreamingDetails?.actualStartTime || null, duration: item?.contentDetails?.duration || null };
  }).filter((video) => {
    if (!video.actualStartTime) return false;
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(video.actualStartTime)).map(({ type, value }) => [type, value]));
    const duration = video.duration?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    const seconds = duration ? Number(duration[1] || 0) * 3600 + Number(duration[2] || 0) * 60 + Number(duration[3] || 0) : 0;
    return parts.year === String(year) && parts.month === String(months.indexOf(month) + 1).padStart(2, '0') && parts.weekday === 'Sun' && [7,8,9,10,11,12].includes(Number(parts.hour)) && seconds >= 600;
  }).map((video) => {
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/El_Salvador', hour: '2-digit', hourCycle: 'h23' }).format(new Date(video.actualStartTime)));
    return { ...video, service: hour < 9 ? '7:00 am' : hour < 11 ? '9:00 am' : '11:00 am' };
  });
}
try {
  const folder = exactlyOne(await driveList(env.drive_id), (f) => normalize(f.name) === month, `month ${month}`);
  const children = await driveList(folder.id);
  const target = exactlyOne(children, (f) => action === 'refugio' ? /^refugios?$/.test(normalize(f.name)) : normalize(f.name) === 'predicas', `folder ${action}`);
  const manifest = { action, month, year, dryRun, sourceFolder: target.name, pdfs: [] };
  if (action === 'refugio') {
    const files = await driveList(target.id);
    const material = exactlyOne(files, (f) => f.mimeType === 'application/pdf' && /^temas?\s+de\s+/.test(normalize(f.name)), 'material PDF');
    const presentation = exactlyOne(files, (f) => f.mimeType === 'application/pdf' && /tema[\s_-]*1/.test(normalize(f.name)), 'presentation PDF');
    const desiredDoc = normalize(args.doc || 'Descripción Web');
    const doc = exactlyOne(files, (f) => f.mimeType === 'application/vnd.google-apps.document' && normalize(f.name) === desiredDoc, `document ${desiredDoc}`);
    const image = exactlyOne(files, (f) => /^image\//.test(f.mimeType) && normalize(f.name).startsWith(month), 'cover image');
    const docPath = path.join(output, 'description.txt'); await driveDownload(doc, docPath, true);
    manifest.descriptionPath = path.relative(root, docPath);
    manifest.pdfs.push(await preparePdf(material, 'discipulado'), await preparePdf(presentation, 'discipulado'));
    const imageWork = await fs.mkdtemp(path.join(temp, 'image-'));
    await driveDownload(image, path.join(imageWork, image.name));
    run('convert-images.sh', imageWork);
    const converted = (await fs.readdir(path.join(imageWork, 'out'))).find((f) => f.endsWith('.webp'));
    if (!converted) throw Error(`No converted image for ${image.name}`);
    const cover = path.join(root, 'public', 'images', 'discipulado-covers', `${month}.webp`);
    if (!dryRun) await fs.copyFile(path.join(imageWork, 'out', converted), cover);
    manifest.coverImage = '/' + path.relative(path.join(root, 'public'), cover).split(path.sep).join('/');
  } else {
    const hours = await driveList(target.id);
    manifest.images = [];
    for (const image of hours.filter((f) => f.mimeType.startsWith('image/'))) manifest.images.push(await preparePredicaImage(image, 'general'));
    for (const hour of hours.sort((a,b) => a.name.localeCompare(b.name))) {
      if (hour.mimeType !== 'application/vnd.google-apps.folder') continue;
      const allFiles = await driveList(hour.id);
      const files = args['only-file'] ? allFiles.filter((file) => normalize(file.name).includes(normalize(args['only-file']))) : allFiles;
      for (const file of files.filter((f) => f.mimeType === 'application/pdf')) {
        const pdf = await preparePdf(file, 'predicas');
        manifest.pdfs.push({ ...pdf, service: hour.name });
      }
      for (const file of files.filter((f) => f.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation')) {
        const pdf = await preparePresentation(file);
        manifest.pdfs.push({ ...pdf, service: hour.name });
      }
      for (const image of files.filter((f) => f.mimeType.startsWith('image/'))) manifest.images.push(await preparePredicaImage(image, hour.name));
    }
    if (!manifest.pdfs.length) throw Error('No sermon PDFs found');
    if (args['only-file'] && manifest.pdfs.length !== 1) throw Error(`--only-file matched ${manifest.pdfs.length} files; use a more specific fragment`);
    manifest.partial = Boolean(args['only-file']);
    manifest.youtubeVideos = await youtubeUploads();
    manifest.expectedServices = sundaySlots(year, months.indexOf(month) + 1);
    manifest.missingVideoServices = manifest.expectedServices.filter(({ date, service }) =>
      !manifest.youtubeVideos.some((video) => salvadorDate(video.actualStartTime) === date && video.service === service));
    console.log(`Sunday video slots: ${manifest.expectedServices.length - manifest.missingVideoServices.length}/${manifest.expectedServices.length}`);
  }
  const manifestPath = path.join(output, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Manifest: ${path.relative(root, manifestPath)}`);
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
