"use client";
import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

type ButtonProps = HTMLMotionProps<'button'> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    disableEnhancements?: boolean;
};

const baseClasses =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold tracking-tight focus:outline-none backdrop-blur-md border shadow-glass';

const variantMap: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'text-white',
    secondary: 'text-white',
    ghost: 'bg-transparent border-transparent text-slate-200 hover:bg-white/6',
    danger: 'bg-red-600 text-white hover:bg-red-700',
};

// Variant map used when button is inside dashboard to avoid hover classes from
// the global variantMap leaking into dashboard buttons. Keeps text/color only.
const variantMapDashboard: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'text-white',
    secondary: 'text-white',
    ghost: 'bg-transparent border-transparent text-slate-200',
    danger: 'text-white',
};

export default function Button({ children, variant = 'primary', className = '', disableEnhancements = false, ...props }: ButtonProps) {
    const ref = React.useRef<HTMLButtonElement | null>(null);
    const [inDashboard, setInDashboard] = React.useState(false);

    React.useEffect(() => {
        try {
            if (!ref.current) return;
            setInDashboard(Boolean(ref.current.closest('.dashboard-main')));
        } catch (e) {
            // ignore
        }
    }, []);

    const dashboardVariant: Record<string, string> = {
        // Dashboard: use the reusable cssbuttons-io styling for all dashboard buttons
        primary: 'cssbuttons-io',
        secondary: 'cssbuttons-io',
        ghost: 'cssbuttons-io',
        danger: 'cssbuttons-io',
    };

    // Apply dashboard-only hover fill when the button is used inside the dashboard area.
    const dashboardClasses = inDashboard && !disableEnhancements ? dashboardVariant[variant] ?? dashboardVariant.primary : '';

    const effectiveVariantClasses = inDashboard ? variantMapDashboard[variant] ?? variantMapDashboard.primary : variantMap[variant];

    const enhancementClasses = disableEnhancements ? '' : (inDashboard ? '' : 'dashboard-btn-effect');

    // Keep inline style minimal; color/border are handled via classes for dashboard buttons.
    const style: React.CSSProperties = {};

    return (
        // Buttons keep translucent fills + blur + glow shadow for a consistent glass treatment.
        <motion.button
            ref={ref as any}
            whileTap={inDashboard ? undefined : { scale: 0.98 }}
            className={`${baseClasses} ${effectiveVariantClasses} ${dashboardClasses} ${enhancementClasses} ${className}`}
            style={style}
            {...props}
        >
            {children}
        </motion.button>
    );
}