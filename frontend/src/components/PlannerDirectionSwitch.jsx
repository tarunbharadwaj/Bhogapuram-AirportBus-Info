export default function PlannerDirectionSwitch({ value, onChange }) {
	return (
		<div
			className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/8"
			role="group"
			aria-label="Trip direction"
		>
			{[
				['to-airport', 'To Airport'],
				['from-airport', 'From Airport']
			].map(([direction, label]) => (
				<button
					key={direction}
					type="button"
					aria-pressed={value === direction}
					className={`min-h-11 rounded-lg px-3 text-xs font-bold transition-[transform,background-color,color,box-shadow] active:scale-[.98] ${value === direction ? 'bg-white text-ink shadow-sm dark:bg-white/12' : 'text-muted hover:text-ink'}`}
					onClick={() => onChange(direction)}
				>
					{label}
				</button>
			))}
		</div>
	);
}
