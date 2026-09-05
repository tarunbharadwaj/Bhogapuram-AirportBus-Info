import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getPageMetadata } from '../src/lib/seo.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexablePaths = [
	'/bhogapuram-airport-bus',
	'/vizag-airport-bus-timings',
	'/bhogapuram-airport-bus-routes',
	'/bhogapuram-airport-bus-fares',
	'/vizag-airport-bus-stops',
	'/routes/asr-1',
	'/routes/asr-2'
];

test('provides distinct indexable metadata for every airport bus guide', () => {
	const titles = new Set();
	for (const path of indexablePaths) {
		const metadata = getPageMetadata(path);
		assert.equal(metadata.robots, 'index, follow');
		assert.match(metadata.url, new RegExp(`${path.replaceAll('/', '\\/')}\\/$`));
		assert.ok(metadata.description.length >= 90);
		titles.add(metadata.title);
	}
	assert.equal(titles.size, indexablePaths.length);
});

test('lists every airport bus guide in the sitemap', async () => {
	const sitemap = await readFile(resolve(root, 'public', 'sitemap.xml'), 'utf8');
	for (const path of indexablePaths)
		assert.match(sitemap, new RegExp(`https://www\\.vizagairportbus\\.com${path.replaceAll('/', '\\/')}\\/`));
	assert.doesNotMatch(sitemap, /service-admin/);
});

test('keeps the admin page out of Google results', () => {
	const metadata = getPageMetadata('/service-admin');
	assert.match(metadata.robots, /noindex/);
});
