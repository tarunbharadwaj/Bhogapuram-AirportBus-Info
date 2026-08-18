import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
	const [dark, setDark] = useState(() =>
		document.documentElement.classList.contains('dark')
	);

	const applyTheme = (useDark) => {
		document.documentElement.classList.toggle('dark', useDark);
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', useDark ? '#0b1116' : '#f4f7f9');
		setDark(useDark);
	};

	useEffect(() => {
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const followSystem = (event) => {
			if (localStorage.getItem('theme')) return;
			applyTheme(event.matches);
		};
		media.addEventListener('change', followSystem);
		return () => media.removeEventListener('change', followSystem);
	}, []);

	const toggle = () => {
		const next = !dark;
		applyTheme(next);
		localStorage.setItem('theme', next ? 'dark' : 'light');
	};

	return (
		<button
			type="button"
			onClick={toggle}
			className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white/75 text-slate-600 shadow-sm backdrop-blur-xl transition-[transform,background-color,color] duration-300 active:scale-95 dark:border-white/10 dark:bg-white/8 dark:text-slate-200"
			aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
			title={dark ? 'Light mode' : 'Dark mode'}
		>
			<Sun
				size={18}
				className={`absolute transition-all duration-300 motion-reduce:transition-none ${dark ? '-rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
			/>
			<Moon
				size={18}
				className={`absolute transition-all duration-300 motion-reduce:transition-none ${dark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-50 opacity-0'}`}
			/>
		</button>
	);
}
