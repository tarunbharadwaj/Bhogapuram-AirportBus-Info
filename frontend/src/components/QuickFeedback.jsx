import {
	CheckCircle2,
	CircleHelp,
	MessageSquareText,
	Send,
	ThumbsDown,
	ThumbsUp,
	X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { trackEvent } from '../lib/analytics.js';
import { isValidFeedbackEndpoint, submitFeedback } from '../lib/feedback.js';
import {
	canShowFeedbackPrompt,
	markFeedbackPromptAnswered,
	markFeedbackPromptDismissed,
	markFeedbackPromptShown
} from '../lib/feedbackPrompt.js';

const endpoint = import.meta.env.VITE_FEEDBACK_FORM_ENDPOINT?.trim() || '';

const ratingOptions = [
	{ value: 'yes', label: 'Yes, it helped', Icon: ThumbsUp },
	{ value: 'unsure', label: 'Not sure yet', Icon: CircleHelp },
	{ value: 'no', label: 'No, it didn’t', Icon: ThumbsDown }
];

const reasonsByRating = {
	yes: [
		['right_bus_found', 'Found the right bus'],
		['stop_details_clear', 'Stop details were clear'],
		['timings_clear', 'Timings were clear'],
		['easy_to_use', 'Easy to use']
	],
	unsure: [
		['timing_confidence_needed', 'Need more confidence in timings'],
		['still_comparing', 'Still comparing options'],
		['information_unclear', 'Some information was unclear'],
		['information_missing', 'Something was missing']
	],
	no: [
		['stop_not_found', 'Couldn’t find my stop'],
		['timings_confusing', 'Timings were confusing'],
		['information_incorrect', 'Information looked incorrect'],
		['plan_not_completed', 'Couldn’t complete my plan'],
		['other', 'Other']
	]
};

const categoryForRating = {
	yes: 'feedback',
	unsure: 'suggestion',
	no: 'complaint'
};

export default function QuickFeedback({
	feedbackContext,
	resultStatus,
	direction,
	routeCode,
	stopId
}) {
	const [visible, setVisible] = useState(false);
	const [rating, setRating] = useState('');
	const [reason, setReason] = useState('');
	const [comment, setComment] = useState('');
	const [honey, setHoney] = useState('');
	const [status, setStatus] = useState('idle');
	const [error, setError] = useState('');
	const shownTracked = useRef(false);
	const ratingRef = useRef('');
	const reasonRef = useRef('');
	const submittingRef = useRef(false);
	const configured = isValidFeedbackEndpoint(endpoint);
	const isUnavailable = resultStatus === 'unavailable';

	const eventParameters = {
		feedback_context: feedbackContext,
		result_status: resultStatus,
		direction,
		...(routeCode ? { route_code: routeCode } : {}),
		...(stopId ? { stop_id: stopId } : {})
	};

	useEffect(() => {
		if (shownTracked.current || !canShowFeedbackPrompt()) return;
		shownTracked.current = true;
		markFeedbackPromptShown();
		setVisible(true);
		trackEvent('feedback_prompt_shown', eventParameters);
	}, [feedbackContext, resultStatus, direction, routeCode, stopId]);

	if (!visible) return null;

	const selectRating = (value) => {
		if (ratingRef.current) return;
		ratingRef.current = value;
		setRating(value);
		markFeedbackPromptAnswered();
		trackEvent('feedback_response', {
			...eventParameters,
			feedback_rating: value
		});
	};

	const selectReason = (value) => {
		if (reasonRef.current) return;
		reasonRef.current = value;
		setReason(value);
		trackEvent('feedback_reason_selected', {
			...eventParameters,
			feedback_rating: rating,
			feedback_reason: value
		});
	};

	const dismiss = () => {
		if (!rating) {
			markFeedbackPromptDismissed();
			trackEvent('feedback_prompt_dismissed', eventParameters);
		}
		setVisible(false);
	};

	const sendComment = async (event) => {
		event.preventDefault();
		if (submittingRef.current) return;
		const trimmedComment = comment.trim();
		if (trimmedComment.length < 10) {
			setError('Please enter at least 10 characters, or choose Done.');
			return;
		}
		if (!configured) return;

		submittingRef.current = true;
		setStatus('submitting');
		setError('');
		try {
			await submitFeedback(endpoint, {
				category: categoryForRating[rating],
				message: trimmedComment,
				email: '',
				honey,
				metadata: {
					source: 'inline-survey',
					rating,
					reason,
					context: feedbackContext,
					direction,
					routeCode,
					stopId
				}
			});
			trackEvent('feedback_comment_submitted', {
				...eventParameters,
				feedback_rating: rating,
				...(reason ? { feedback_reason: reason } : {})
			});
			setStatus('success');
		} catch {
			setStatus('error');
			setError('We could not send your comment. Check your connection and try again.');
		} finally {
			submittingRef.current = false;
		}
	};

	return (
		<section
			className="adaptive-material relative rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-[0_18px_45px_rgba(20,43,56,.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 max-sm:p-4"
			aria-labelledby="quick-feedback-title"
		>
			<button
				type="button"
				className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-ink active:scale-95 dark:hover:bg-white/8"
				onClick={dismiss}
				aria-label={rating ? 'Close feedback' : 'Dismiss feedback for now'}
			>
				<X size={18} />
			</button>

			{status === 'success' ? (
				<div className="flex items-start gap-3 pr-11" role="status" aria-live="polite">
					<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300">
						<CheckCircle2 size={20} />
					</span>
					<div>
						<h2 className="text-sm font-bold">Thank you for helping improve the website.</h2>
						<p className="mt-1 text-xs leading-5 text-muted">Your comment has been sent.</p>
					</div>
				</div>
			) : (
				<>
					<div className="flex items-start gap-3 pr-11">
						<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
							<MessageSquareText size={20} />
						</span>
						<div>
							<p className="text-[.65rem] font-extrabold uppercase tracking-[.12em] text-brand">
								Quick feedback
							</p>
							<h2 className="mt-1 text-base font-bold" id="quick-feedback-title">
								{isUnavailable
									? 'Did this result answer your question?'
									: 'Did this help you plan your airport trip?'}
							</h2>
							<p className="mt-1 text-xs leading-5 text-muted">One tap is enough. No login required.</p>
						</div>
					</div>

					{!rating ? (
						<div className="mt-4 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
							{ratingOptions.map(({ value, label, Icon }) => (
								<button
									key={value}
									type="button"
									className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 text-sm font-bold transition hover:border-brand/35 hover:bg-brand-soft active:scale-[.98] dark:border-white/10 dark:bg-white/5"
									onClick={() => selectRating(value)}
								>
									<Icon size={17} /> {label}
								</button>
							))}
						</div>
					) : (
						<form className="mt-5" onSubmit={sendComment} noValidate>
							<p className="text-sm font-bold">Thanks. What was the main reason?</p>
							<div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Feedback reason">
								{reasonsByRating[rating].map(([value, label]) => {
									const selected = reason === value;
									return (
										<button
											type="button"
											key={value}
											className={`min-h-10 rounded-full border px-3 py-2 text-xs font-semibold transition active:scale-[.98] ${selected ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white/65 text-muted hover:border-brand/35 dark:border-white/10 dark:bg-white/5'} ${reason && !selected ? 'opacity-55' : ''}`}
											disabled={Boolean(reason) && !selected}
											aria-pressed={selected}
											onClick={() => selectReason(value)}
										>
											{label}
										</button>
									);
								})}
							</div>

							{configured ? (
								<>
									<label className="mt-5 block text-sm font-bold" htmlFor="quick-feedback-comment">
										Anything else we should know?{' '}
										<span className="font-normal text-muted">(optional)</span>
										<textarea
											id="quick-feedback-comment"
											className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white/75 px-3 py-3 text-sm leading-5 outline-none transition focus:border-brand/60 focus:ring-4 focus:ring-brand/10 dark:border-white/10 dark:bg-white/6"
											placeholder="Tell us what worked or what should be improved…"
											maxLength={1000}
											value={comment}
											aria-invalid={Boolean(error)}
											onChange={(event) => {
												setComment(event.target.value);
												setError('');
											}}
										/>
									</label>
									<div className="mt-1 flex items-start justify-between gap-3 text-[.65rem]">
										<span className={error ? 'text-red-600 dark:text-red-300' : 'text-muted'} role={error ? 'alert' : undefined}>
											{error || 'Written comments are emailed to the site owner.'}
										</span>
										<span className="shrink-0 text-slate-400">{comment.length}/1,000</span>
									</div>
								</>
							) : (
								<p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:bg-amber-300/10 dark:text-amber-200">
									Your quick response was accepted, but written comments are temporarily unavailable.
								</p>
							)}

							<label className="hidden" aria-hidden="true">
								Leave this field empty
								<input
									tabIndex="-1"
									autoComplete="off"
									name="_honey"
									value={honey}
									onChange={(event) => setHoney(event.target.value)}
								/>
							</label>

							<div className="mt-4 flex flex-wrap items-center gap-2 max-sm:grid max-sm:grid-cols-1">
								{configured && comment.trim() && (
									<button
										type="submit"
										className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white transition active:scale-[.98] disabled:opacity-55"
										disabled={status === 'submitting'}
									>
										<Send size={16} /> {status === 'submitting' ? 'Sending…' : 'Send comment'}
									</button>
								)}
								<button
									type="button"
									className="min-h-11 rounded-xl border border-slate-200 bg-white/60 px-4 text-sm font-bold transition active:scale-[.98] dark:border-white/10 dark:bg-white/5"
									onClick={() => setVisible(false)}
								>
									Done
								</button>
								<a className="ml-auto text-xs font-semibold text-brand underline-offset-4 hover:underline max-sm:ml-0 max-sm:text-center" href="/feedback">
									Need a reply? Send detailed feedback
								</a>
							</div>
						</form>
					)}
				</>
			)}
		</section>
	);
}
