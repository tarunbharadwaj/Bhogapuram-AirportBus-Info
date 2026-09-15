const fs = require('node:fs/promises');
const path = require('node:path');
const QRCode = require('qrcode');

const SITE_URL = 'https://vizagairportbus.com';
const OUTPUT_DIRECTORY = path.resolve(__dirname, '..', 'frontend', 'public', 'qr');
const MAX_TRACKING_VALUE_LENGTH = 100;
const SUPPORTED_ARGUMENTS = new Set(['source', 'campaign']);

function usage() {
	return [
		'Generate the default website QR:',
		'  npm run generate-qr',
		'',
		'Generate a campaign QR:',
		'  npm run generate-qr -- --source=hotel --campaign=hotel_name'
	].join('\n');
}

function parseArguments(argv) {
	const values = {};
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === '--help' || argument === '-h') return { help: true };
		if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);

		const separator = argument.indexOf('=');
		const key = argument.slice(2, separator === -1 ? undefined : separator);
		if (!SUPPORTED_ARGUMENTS.has(key)) throw new Error(`Unsupported option: --${key}`);
		if (Object.hasOwn(values, key)) throw new Error(`Option --${key} was provided more than once.`);

		let value = separator === -1 ? argv[index + 1] : argument.slice(separator + 1);
		if (separator === -1) {
			if (!value || value.startsWith('--')) throw new Error(`Option --${key} requires a value.`);
			index += 1;
		}
		value = value.trim();
		if (!value) throw new Error(`Option --${key} cannot be empty.`);
		if (value.length > MAX_TRACKING_VALUE_LENGTH || /[\u0000-\u001f\u007f]/.test(value)) {
			throw new Error(`Option --${key} contains an invalid value.`);
		}
		values[key] = value;
	}

	const hasSource = Object.hasOwn(values, 'source');
	const hasCampaign = Object.hasOwn(values, 'campaign');
	if (hasSource !== hasCampaign) {
		throw new Error('Campaign QR codes require both --source and --campaign.');
	}
	return values;
}

function safeCampaignFilename(value) {
	const slug = value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-+/g, '-')
		.slice(0, 60)
		.replace(/-+$/g, '');
	if (!slug) throw new Error('The campaign name cannot produce a safe filename. Use letters or numbers.');
	return slug;
}

function createDestinationUrl(options) {
	const url = new URL(SITE_URL);
	if (options.source && options.campaign) {
		url.searchParams.set('utm_source', options.source);
		url.searchParams.set('utm_medium', 'qr');
		url.searchParams.set('utm_campaign', options.campaign);
	}
	return url.toString();
}

async function generate(options) {
	const destinationUrl = createDestinationUrl(options);
	const suffix = options.campaign ? `-${safeCampaignFilename(options.campaign)}` : '';
	const baseName = `vizag-airport-bus${suffix}-qr`;
	const pngPath = path.join(OUTPUT_DIRECTORY, `${baseName}.png`);
	const svgPath = path.join(OUTPUT_DIRECTORY, `${baseName}.svg`);
	const commonOptions = {
		errorCorrectionLevel: 'H',
		margin: 6,
		width: 1500,
		color: { dark: '#000000ff', light: '#ffffffff' }
	};

	await fs.mkdir(OUTPUT_DIRECTORY, { recursive: true });
	await Promise.all([
		QRCode.toFile(pngPath, destinationUrl, { ...commonOptions, type: 'png' }),
		QRCode.toFile(svgPath, destinationUrl, { ...commonOptions, type: 'svg' })
	]);

	const displayPath = (filePath) => path.relative(path.resolve(__dirname, '..'), filePath).replaceAll('\\', '/');
	console.log('QR generated successfully');
	console.log(`Destination URL: ${destinationUrl}`);
	console.log(`PNG: ${displayPath(pngPath)}`);
	console.log(`SVG: ${displayPath(svgPath)}`);
	return { destinationUrl, pngPath, svgPath };
}

async function main() {
	try {
		const options = parseArguments(process.argv.slice(2));
		if (options.help) {
			console.log(usage());
			return;
		}
		await generate(options);
	} catch (error) {
		console.error(`QR generation failed: ${error.message}`);
		console.error(`\n${usage()}`);
		process.exitCode = 1;
	}
}

if (require.main === module) main();

module.exports = { createDestinationUrl, generate, parseArguments, safeCampaignFilename };
