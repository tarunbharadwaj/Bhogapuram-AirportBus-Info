export const FEEDBACK_CATEGORIES = Object.freeze([
	{ value: 'feedback', label: 'Feedback' },
	{ value: 'suggestion', label: 'Suggestion' },
	{ value: 'complaint', label: 'Complaint' }
]);

const categoryValues = new Set(FEEDBACK_CATEGORIES.map(({ value }) => value));
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
	{ category, message, email, honey },
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
		_subject: 'New Bhogapuram Airport Bus website feedback',
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
