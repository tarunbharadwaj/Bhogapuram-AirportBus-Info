const DAY_MS = 24 * 60 * 60 * 1000;

export const FEEDBACK_COOLDOWN_KEY = 'vizag-airport-bus-feedback-v1';
export const FEEDBACK_SESSION_KEY = 'vizag-airport-bus-feedback-session-v1';
export const DISMISSED_COOLDOWN_MS = 7 * DAY_MS;
export const ANSWERED_COOLDOWN_MS = 90 * DAY_MS;

let shownInMemory = false;

const resolveStorage = (provided, name) => {
	if (provided !== undefined) return provided;
	try {
		return typeof window === 'undefined' ? null : window[name];
	} catch {
		return null;
	}
};

const readRecord = (storage, key) => {
	if (!storage) return {};
	try {
		const value = JSON.parse(storage.getItem(key) || '{}');
		return value && typeof value === 'object' && !Array.isArray(value)
			? value
			: {};
	} catch {
		return {};
	}
};

const writeRecord = (storage, key, value) => {
	if (!storage) return false;
	try {
		storage.setItem(key, JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
};

const isRecent = (timestamp, duration, now) =>
	Number.isFinite(timestamp) &&
	timestamp > 0 &&
	timestamp <= now &&
	now - timestamp < duration;

export const canShowFeedbackPrompt = ({
	now = Date.now(),
	localStorage,
	sessionStorage
} = {}) => {
	const local = resolveStorage(localStorage, 'localStorage');
	const session = resolveStorage(sessionStorage, 'sessionStorage');
	const cooldown = readRecord(local, FEEDBACK_COOLDOWN_KEY);
	const sessionState = readRecord(session, FEEDBACK_SESSION_KEY);

	if (isRecent(cooldown.answeredAt, ANSWERED_COOLDOWN_MS, now)) return false;
	if (isRecent(cooldown.dismissedAt, DISMISSED_COOLDOWN_MS, now)) return false;
	if (Number.isFinite(sessionState.shownAt) && sessionState.shownAt > 0)
		return false;
	return !shownInMemory;
};

export const markFeedbackPromptShown = ({
	now = Date.now(),
	sessionStorage
} = {}) => {
	shownInMemory = true;
	const session = resolveStorage(sessionStorage, 'sessionStorage');
	writeRecord(session, FEEDBACK_SESSION_KEY, { shownAt: now });
};

const markCooldown = (field, { now = Date.now(), localStorage } = {}) => {
	const local = resolveStorage(localStorage, 'localStorage');
	const current = readRecord(local, FEEDBACK_COOLDOWN_KEY);
	writeRecord(local, FEEDBACK_COOLDOWN_KEY, { ...current, [field]: now });
};

export const markFeedbackPromptDismissed = (options) =>
	markCooldown('dismissedAt', options);

export const markFeedbackPromptAnswered = (options) =>
	markCooldown('answeredAt', options);

export const resetFeedbackPromptMemoryForTests = () => {
	shownInMemory = false;
};

