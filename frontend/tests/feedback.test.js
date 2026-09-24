import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeAnalyticsParameters } from '../src/lib/analytics.js';
import {
	inlineFeedbackMetadata,
	submitFeedback
} from '../src/lib/feedback.js';
import {
	ANSWERED_COOLDOWN_MS,
	canShowFeedbackPrompt,
	DISMISSED_COOLDOWN_MS,
	markFeedbackPromptAnswered,
	markFeedbackPromptDismissed,
	markFeedbackPromptShown,
	resetFeedbackPromptMemoryForTests
} from '../src/lib/feedbackPrompt.js';

class MemoryStorage {
	#values = new Map();

	getItem(key) {
		return this.#values.get(key) ?? null;
	}

	setItem(key, value) {
		this.#values.set(key, String(value));
	}
}

const freshStorage = () => ({
	localStorage: new MemoryStorage(),
	sessionStorage: new MemoryStorage()
});

test('shows feedback once in a browser session', () => {
	resetFeedbackPromptMemoryForTests();
	const storage = freshStorage();
	const now = Date.UTC(2026, 8, 24);
	assert.equal(canShowFeedbackPrompt({ now, ...storage }), true);
	markFeedbackPromptShown({ now, sessionStorage: storage.sessionStorage });
	assert.equal(canShowFeedbackPrompt({ now, ...storage }), false);
});

test('applies seven-day dismissed and ninety-day answered cooldowns', () => {
	const now = Date.UTC(2026, 8, 24);

	resetFeedbackPromptMemoryForTests();
	const dismissed = freshStorage();
	markFeedbackPromptDismissed({ now, localStorage: dismissed.localStorage });
	assert.equal(
		canShowFeedbackPrompt({ now: now + DISMISSED_COOLDOWN_MS - 1, ...dismissed }),
		false
	);
	resetFeedbackPromptMemoryForTests();
	assert.equal(
		canShowFeedbackPrompt({ now: now + DISMISSED_COOLDOWN_MS, ...dismissed }),
		true
	);

	resetFeedbackPromptMemoryForTests();
	const answered = freshStorage();
	markFeedbackPromptAnswered({ now, localStorage: answered.localStorage });
	assert.equal(
		canShowFeedbackPrompt({ now: now + ANSWERED_COOLDOWN_MS - 1, ...answered }),
		false
	);
	resetFeedbackPromptMemoryForTests();
	assert.equal(
		canShowFeedbackPrompt({ now: now + ANSWERED_COOLDOWN_MS, ...answered }),
		true
	);
});

test('ignores malformed cooldown storage and falls back safely', () => {
	resetFeedbackPromptMemoryForTests();
	const storage = freshStorage();
	storage.localStorage.setItem('vizag-airport-bus-feedback-v1', '{not-json');
	storage.sessionStorage.setItem('vizag-airport-bus-feedback-session-v1', '[]');
	assert.equal(canShowFeedbackPrompt(storage), true);
});

test('uses in-memory session protection when browser storage is unavailable', () => {
	resetFeedbackPromptMemoryForTests();
	const unavailableStorage = {
		getItem() {
			throw new Error('Storage blocked');
		},
		setItem() {
			throw new Error('Storage blocked');
		}
	};
	assert.equal(
		canShowFeedbackPrompt({
			localStorage: unavailableStorage,
			sessionStorage: unavailableStorage
		}),
		true
	);
	markFeedbackPromptShown({ sessionStorage: unavailableStorage });
	assert.equal(
		canShowFeedbackPrompt({
			localStorage: unavailableStorage,
			sessionStorage: unavailableStorage
		}),
		false
	);
});

test('keeps only approved inline feedback metadata', () => {
	assert.deepEqual(
		inlineFeedbackMetadata({
			source: 'inline-survey',
			rating: 'no',
			reason: 'timings_confusing',
			context: 'to_airport_success',
			direction: 'to-airport',
			routeCode: 'ASR-1',
			stopId: 'gajuwaka-stop',
			coordinates: '17.6,83.2',
			flightTime: '08:15'
		}),
		{
			feedback_source: 'Inline planner survey',
			feedback_rating: 'no',
			feedback_context: 'to_airport_success',
			direction: 'to-airport',
			feedback_reason: 'timings_confusing',
			route_code: 'ASR-1',
			stop_id: 'gajuwaka-stop'
		}
	);
});

test('sends inline comments with safe context and a distinct subject', async () => {
	let request;
	const fakeFetch = async (url, options) => {
		request = { url, options };
		return {
			ok: true,
			json: async () => ({ success: true })
		};
	};

	await submitFeedback(
		'https://formsubmit.co/ajax/random-token',
		{
			category: 'complaint',
			message: 'The stop timing was not clear.',
			metadata: {
				source: 'inline-survey',
				rating: 'no',
				reason: 'timings_confusing',
				context: 'to_airport_success',
				direction: 'to-airport',
				routeCode: 'ASR-1',
				stopId: 'gajuwaka-stop'
			}
		},
		fakeFetch
	);

	const payload = JSON.parse(request.options.body);
	assert.equal(payload._subject, 'New Vizag Airport Bus inline feedback');
	assert.equal(payload.feedback_rating, 'no');
	assert.equal(payload.feedback_reason, 'timings_confusing');
	assert.equal(payload.route_code, 'ASR-1');
	assert.equal(payload.email, undefined);
});

test('analytics removes comments, contact details, coordinates and travel times', () => {
	assert.deepEqual(
		sanitizeAnalyticsParameters({
			feedback_rating: 'yes',
			feedback_reason: 'easy_to_use',
			feedback_context: 'from_airport_success',
			result_status: 'success',
			direction: 'from-airport',
			route_code: 'ASR-2',
			stop_id: 'siripuram-stop',
			comment: 'private message',
			email: 'person@example.com',
			coordinates: '17.7,83.3',
			travel_time: '08:15'
		}),
		{
			feedback_rating: 'yes',
			feedback_reason: 'easy_to_use',
			feedback_context: 'from_airport_success',
			result_status: 'success',
			direction: 'from-airport',
			route_code: 'ASR-2',
			stop_id: 'siripuram-stop'
		}
	);
});
