import {
	ArrowLeft,
	CheckCircle2,
	CircleAlert,
	Lightbulb,
	Mail,
	MessageSquareText,
	Send,
	ShieldCheck
} from 'lucide-react';
import { useRef, useState } from 'react';
import Brand from '../components/Brand.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { trackEvent } from '../lib/analytics.js';
import {
	FEEDBACK_CATEGORIES,
	isValidFeedbackEndpoint,
	submitFeedback,
	validateFeedback
} from '../lib/feedback.js';

const endpoint = import.meta.env.VITE_FEEDBACK_FORM_ENDPOINT?.trim() || '';
const categoryIcons = {
	feedback: MessageSquareText,
	suggestion: Lightbulb,
	complaint: CircleAlert
};

const inputClass =
	'mt-2 w-full rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm text-ink shadow-sm outline-none transition-[border-color,box-shadow,background-color] focus:border-brand/60 focus:ring-4 focus:ring-brand/10 dark:border-white/10 dark:bg-white/6';

export default function FeedbackPage() {
	const [form, setForm] = useState({
		category: 'feedback',
		message: '',
		email: '',
		honey: ''
	});
	const [errors, setErrors] = useState({});
	const [status, setStatus] = useState('idle');
	const [submitError, setSubmitError] = useState('');
	const messageRef = useRef(null);
	const emailRef = useRef(null);
	const configured = isValidFeedbackEndpoint(endpoint);

	const updateField = (field, value) => {
		setForm((current) => ({ ...current, [field]: value }));
		setErrors((current) => ({ ...current, [field]: undefined }));
		if (status === 'error') {
			setStatus('idle');
			setSubmitError('');
		}
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		if (status === 'submitting') return;

		const nextErrors = validateFeedback(form);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length) {
			if (nextErrors.message) messageRef.current?.focus();
			else if (nextErrors.email) emailRef.current?.focus();
			return;
		}
		if (!configured) return;

		setStatus('submitting');
		setSubmitError('');
		try {
			await submitFeedback(endpoint, form);
			trackEvent('feedback_submitted', { feedback_type: form.category });
			setStatus('success');
			setForm({ category: 'feedback', message: '', email: '', honey: '' });
		} catch {
			setStatus('error');
			setSubmitError(
				'We could not send your message right now. Check your connection and try again.'
			);
		}
	};

	const sendAnother = () => {
		setStatus('idle');
		setSubmitError('');
		window.requestAnimationFrame(() => messageRef.current?.focus());
	};

	return (
		<div className="relative min-h-screen overflow-hidden bg-[#f3f6f7] transition-colors duration-300 dark:bg-[#0b1116]">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_25%_10%,rgba(8,127,120,.14),transparent_42%),radial-gradient(circle_at_80%_0%,rgba(55,103,232,.08),transparent_34%)] dark:bg-[radial-gradient(circle_at_25%_10%,rgba(19,162,151,.12),transparent_42%),radial-gradient(circle_at_80%_0%,rgba(72,112,220,.08),transparent_34%)]" />
			<header className="adaptive-material relative z-10 mx-auto flex h-19 max-w-5xl items-center justify-between px-6 backdrop-blur-xl max-md:h-16 max-md:px-4">
				<Brand />
				<div className="flex items-center gap-2">
					<a
						className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted transition hover:bg-white/70 active:scale-[.98] dark:hover:bg-white/8"
						href="/"
					>
						<ArrowLeft size={17} />
						<span className="max-sm:hidden">Back to website</span>
					</a>
					<ThemeToggle />
				</div>
			</header>

			<main className="relative z-10 mx-auto flex max-w-5xl justify-center px-6 pt-16 pb-20 max-md:px-4 max-md:pt-10">
				<section className="w-full max-w-2xl" aria-labelledby="feedback-title">
					<div className="mx-auto max-w-xl text-center">
						<span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
							<MessageSquareText size={23} />
						</span>
						<p className="mt-5 text-xs font-extrabold uppercase tracking-[.13em] text-brand">
							Your voice matters
						</p>
						<h1
							className="mt-3 text-[clamp(2.1rem,6vw,3.6rem)] leading-[1.03] font-bold tracking-[-.045em]"
							id="feedback-title"
						>
							Help make every trip easier.
						</h1>
						<p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-muted">
							Share what worked, what could be clearer, or a problem you faced. Your
							message goes directly to the person maintaining this website.
						</p>
					</div>

					<div className="adaptive-material mt-10 rounded-[1.75rem] border border-white bg-white/78 p-7 shadow-[0_24px_70px_rgba(20,43,56,.10)] backdrop-blur-2xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/78 dark:shadow-[0_28px_80px_rgba(0,0,0,.34)] max-sm:p-5">
						{status === 'success' ? (
							<div className="py-8 text-center" role="status" aria-live="polite">
								<span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300">
									<CheckCircle2 size={30} />
								</span>
								<h2 className="mt-5 text-2xl font-bold tracking-[-.025em]">
									Thank you for helping.
								</h2>
								<p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
									Your message has been sent. Every thoughtful note helps make the
									planner better for fellow travellers.
								</p>
								<div className="mt-7 flex justify-center gap-3 max-sm:flex-col">
									<a
										className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold transition active:scale-[.98] dark:border-white/10 dark:bg-white/6"
										href="/"
									>
										Back to website
									</a>
									<button
										className="min-h-12 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-lg shadow-brand/20 transition active:scale-[.98]"
										type="button"
										onClick={sendAnother}
									>
										Send another response
									</button>
								</div>
							</div>
						) : (
							<form noValidate onSubmit={handleSubmit}>
								<fieldset>
									<legend className="text-sm font-bold">
										What would you like to share?
									</legend>
									<div className="mt-3 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
										{FEEDBACK_CATEGORIES.map(({ value, label }) => {
											const Icon = categoryIcons[value];
											const selected = form.category === value;
											return (
												<label
													className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition-[transform,border-color,background-color,color,box-shadow] focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-blue-300 active:scale-[.98] ${selected ? 'border-brand/40 bg-brand-soft text-brand shadow-sm' : 'border-slate-200 bg-white/55 text-muted hover:border-brand/25 dark:border-white/10 dark:bg-white/4'}`}
													key={value}
												>
													<input
														className="sr-only"
														type="radio"
														name="category"
														value={value}
														checked={selected}
														onChange={(event) => updateField('category', event.target.value)}
													/>
													<Icon size={17} /> {label}
												</label>
											);
										})}
									</div>
									{errors.category && (
										<p className="mt-2 text-xs text-red-600 dark:text-red-300">
											{errors.category}
										</p>
									)}
								</fieldset>

								<label
									className="mt-6 block text-sm font-bold"
									htmlFor="feedback-message"
								>
									Your message
									<textarea
										ref={messageRef}
										className={`${inputClass} min-h-40 resize-y py-3.5 leading-6`}
										id="feedback-message"
										name="message"
										value={form.message}
										onChange={(event) => updateField('message', event.target.value)}
										maxLength={2000}
										aria-describedby="message-help message-error"
										aria-invalid={Boolean(errors.message)}
										placeholder="Tell us what happened or what would make this website more useful…"
									/>
								</label>
								<div className="mt-2 flex justify-between gap-4 text-[.68rem]">
									<p
										className={
											errors.message ? 'text-red-600 dark:text-red-300' : 'text-muted'
										}
										id="message-error"
									>
										{errors.message ||
											'Please include enough detail for us to understand.'}
									</p>
									<span className="shrink-0 text-slate-400" id="message-help">
										{form.message.length}/2,000
									</span>
								</div>

								<label
									className="mt-6 block text-sm font-bold"
									htmlFor="feedback-email"
								>
									Email <span className="font-normal text-muted">(optional)</span>
									<div className="relative">
										<Mail
											className="pointer-events-none absolute top-1/2 left-4 mt-1 -translate-y-1/2 text-slate-400"
											size={18}
										/>
										<input
											className={`${inputClass} h-13 pl-11`}
											ref={emailRef}
											id="feedback-email"
											name="email"
											type="email"
											inputMode="email"
											autoComplete="email"
											value={form.email}
											onChange={(event) => updateField('email', event.target.value)}
											maxLength={254}
											aria-describedby="email-help"
											aria-invalid={Boolean(errors.email)}
											placeholder="you@example.com"
										/>
									</div>
								</label>
								<p
									className={`mt-2 text-[.68rem] ${errors.email ? 'text-red-600 dark:text-red-300' : 'text-muted'}`}
									id="email-help"
								>
									{errors.email || 'Only provide this if you would like a reply.'}
								</p>

								<label className="hidden" aria-hidden="true">
									Leave this field empty
									<input
										tabIndex="-1"
										autoComplete="off"
										name="_honey"
										value={form.honey}
										onChange={(event) => updateField('honey', event.target.value)}
									/>
								</label>

								<div className="mt-6 flex items-start gap-3 rounded-2xl bg-slate-100/90 p-4 text-xs leading-5 text-muted dark:bg-white/5">
									<ShieldCheck className="mt-0.5 shrink-0 text-brand" size={18} />
									<p>
										Your message is securely submitted and emailed to the site owner. Do
										not include sensitive personal or travel information.
									</p>
								</div>

								{!configured && (
									<p
										className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-300/10 dark:text-amber-200"
										role="status"
									>
										Feedback is temporarily unavailable. Please try again later.
									</p>
								)}
								{status === 'error' && (
									<p
										className="mt-5 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-200"
										role="alert"
									>
										<CircleAlert className="mt-0.5 shrink-0" size={17} /> {submitError}
									</p>
								)}

								<button
									className="mt-6 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-[0_10px_28px_rgba(8,127,120,.24)] transition-[transform,background-color,opacity] hover:bg-brand-dark active:scale-[.985] disabled:cursor-not-allowed disabled:opacity-55"
									type="submit"
									disabled={!configured || status === 'submitting'}
								>
									{status === 'submitting' ? (
										<>
											<span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white motion-reduce:animate-none" />
											Sending…
										</>
									) : (
										<>
											<Send size={17} /> Send feedback
										</>
									)}
								</button>
							</form>
						)}
					</div>
				</section>
			</main>
		</div>
	);
}
