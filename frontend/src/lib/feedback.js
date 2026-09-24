export const FEEDBACK_CATEGORIES = Object.freeze([
	{ value: 'feedback', label: 'Feedback' },
	{ value: 'suggestion', label: 'Suggestion' },
	{ value: 'complaint', label: 'Complaint' }
]);

const categoryValues = new Set(FEEDBACK_CATEGORIES.map(({ value }) => value));
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inlineRatings = new Set(['yes', 'unsure', 'no']);
const inlineContexts = new Set([
	'to_airport_success',
	'to_airport_unavailable',
	'from_airport_success',
	'from_airport_unavailable'
]);
const directions = new Set(['to-airport', 'from-airport']);

const safeIdentifier = (value, maximumLength = 100) =>
	typeof value === 'string' && /^[a-z0-9_-]+$/i.test(value)
		? value.slice(0, maximumLength)
		: '';

export const inlineFeedbackMetadata = (metadata = {}) => {
	if (metadata.source !== 'inline-survey') return {};
	const values = { feedback_source: 'Inline planner survey' };
	if (inlineRatings.has(metadata.rating)) values.feedback_rating = metadata.rating;
	if (inlineContexts.has(metadata.context)) values.feedback_context = metadata.context;
	if (directions.has(metadata.direction)) values.direction = metadata.direction;

	const reason = safeIdentifier(metadata.reason);
	const routeCode = safeIdentifier(metadata.routeCode, 30);
	const stopId = safeIdentifier(metadata.stopId);
	if (reason) values.feedback_reason = reason;
	if (routeCode) values.route_code = routeCode;
	if (stopId) values.stop_id = stopId;
	return values;
};

export const isValidFeedbackEndpoint = (value) => {
	try {
		const endpoint = new URL(value);
		return (
			endpoint.protocol === 'https:' &&
			endpoint.hostname === 'formsubmit.co' &&
			/^\/ajax\/[^/]+$/.test(endpoint.pathname) &&
			!endpoint.username &&
			!endpoint.password &&
			!endpoint.search &&
			!endpoint.hash
		);
	} catch {
		return false;
	}
};

export const validateFeedback = ({ category, message, email }) => {
	const errors = {};
	const trimmedMessage = message.trim();
	const trimmedEmail = email.trim();

	if (!categoryValues.has(category)) errors.category = 'Choose a feedback type.';
	if (trimmedMessage.length < 10)
		errors.message = 'Please enter at least 10 characters.';
	else if (trimmedMessage.length > 2000)
		errors.message = 'Please keep your message within 2,000 characters.';
	if (trimmedEmail && !emailPattern.test(trimmedEmail))
		errors.email = 'Enter a valid email address or leave this field empty.';

	return errors;
};

export const submitFeedback = async (
	endpoint,
	{ category, message, email = '', honey = '', metadata },
	fetchImplementation = fetch
) => {
	if (!isValidFeedbackEndpoint(endpoint))
		throw new Error('Feedback delivery is not configured.');

	const categoryLabel =
		FEEDBACK_CATEGORIES.find(({ value }) => value === category)?.label ||
		'Feedback';
	const payload = {
		category: categoryLabel,
		message: message.trim(),
		...inlineFeedbackMetadata(metadata),
		_subject:
			metadata?.source === 'inline-survey'
				? 'New Vizag Airport Bus inline feedback'
				: 'New Vizag Airport Bus website feedback',
		_template: 'table',
		_captcha: 'false',
		_honey: honey
	};
	if (email.trim()) payload.email = email.trim();

	const response = await fetchImplementation(endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify(payload)
	});
	const body = await response.json().catch(() => null);
	if (!response.ok || body?.success === false || body?.success === 'false')
		throw new Error(body?.message || 'Your feedback could not be sent.');

	return body;
};
