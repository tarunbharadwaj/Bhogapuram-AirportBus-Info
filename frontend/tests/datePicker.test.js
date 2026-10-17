import assert from 'node:assert/strict';
import test from 'node:test';
import {
	isIOSDatePickerDevice,
	openDatePickerFromInput
} from '../src/lib/datePicker.js';

test('recognizes iPhone and touch-capable iPad navigator values', () => {
	assert.equal(
		isIOSDatePickerDevice({
			userAgent: 'Mozilla/5.0 (iPhone) CriOS/141.0 Mobile/15E148',
			platform: 'iPhone',
			maxTouchPoints: 5
		}),
		true
	);
	assert.equal(
		isIOSDatePickerDevice({
			userAgent: 'Mozilla/5.0 (Macintosh)',
			platform: 'MacIntel',
			maxTouchPoints: 5
		}),
		true
	);
	assert.equal(
		isIOSDatePickerDevice({
			userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/141.0',
			platform: 'Win32',
			maxTouchPoints: 0
		}),
		false
	);
});

test('opens supported desktop pickers and preserves the iOS native fallback', () => {
	let calls = 0;
	const event = { currentTarget: { showPicker: () => { calls += 1; } } };
	openDatePickerFromInput(event, {
		userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/141.0',
		platform: 'Win32'
	});
	assert.equal(calls, 1);

	openDatePickerFromInput(event, {
		userAgent: 'Mozilla/5.0 (iPhone) CriOS/141.0 Mobile/15E148',
		platform: 'iPhone',
		maxTouchPoints: 5
	});
	assert.equal(calls, 1);
});
