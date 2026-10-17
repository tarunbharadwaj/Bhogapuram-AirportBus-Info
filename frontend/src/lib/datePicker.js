export const isIOSDatePickerDevice = (navigatorValue = globalThis.navigator) => {
	const userAgent = navigatorValue?.userAgent || '';
	const platform = navigatorValue?.platform || '';
	const touchPoints = Number(navigatorValue?.maxTouchPoints) || 0;
	return (
		/iPad|iPhone|iPod/i.test(userAgent) ||
		(platform === 'MacIntel' && touchPoints > 1)
	);
};

export const openDatePickerFromInput = (
	event,
	navigatorValue = globalThis.navigator
) => {
	const input = event.currentTarget;
	if (isIOSDatePickerDevice(navigatorValue)) return;
	try {
		input.showPicker?.();
	} catch {
		// Direct activation of the native input remains the cross-browser fallback.
	}
};
