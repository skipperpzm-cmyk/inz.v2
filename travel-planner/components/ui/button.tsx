"use client";
import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

type ButtonProps = HTMLMotionProps<'button'> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    disableEnhancements?: boolean;
    useTextTheme?: boolean;
};

const baseClasses =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold tracking-tight focus:outline-none border transition-colors duration-150';

const variantMap: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'text-white bg-slate-700 border-slate-600 hover:bg-slate-600 hover:text-white',
    secondary: 'text-white bg-white/5 border-white/10 hover:bg-slate-600 hover:text-white hover:border-slate-500',
    ghost: 'bg-transparent border-transparent text-slate-200 hover:bg-slate-600 hover:text-white hover:border hover:border-slate-500',
    danger: 'bg-red-600/90 border-red-500/80 text-white hover:bg-red-600',
};

// Variant map used when button is inside dashboard to avoid hover classes from
// the global variantMap leaking into dashboard buttons. Keeps text/color only.
const variantMapDashboard: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: variantMap.primary,
    secondary: variantMap.secondary,
    ghost: variantMap.ghost,
    danger: variantMap.danger,
};

function getNodeText(node: unknown): string {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getNodeText).join(' ');
    if (
        typeof node === 'object' &&
        node !== null &&
        'get' in node &&
        typeof (node as { get?: unknown }).get === 'function'
    ) {
        const value = (node as { get: () => unknown }).get();
        return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    }
    if (React.isValidElement(node)) {
        const element = node as React.ReactElement<{ children?: React.ReactNode }>;
        return getNodeText(element.props.children);
    }
    return '';
}

export default function Button({ children, variant = 'primary', className = '', disableEnhancements = false, useTextTheme = true, ...props }: ButtonProps) {
    const ref = React.useRef<HTMLButtonElement | null>(null);
    const [inDashboard, setInDashboard] = React.useState(false);
    const [inDropdownMenu, setInDropdownMenu] = React.useState(false);

    React.useEffect(() => {
        try {
            if (!ref.current) return;
            setInDashboard(Boolean(ref.current.closest('.dashboard-main')));
            setInDropdownMenu(
                Boolean(
                    ref.current.closest(
                        '.board-country-menu, .app-dropdown-menu, [role="menu"], .dropdown-menu'
                    )
                )
            );
        } catch (e) {
            // ignore
        }
    }, []);

    const dashboardClasses = disableEnhancements ? '' : '';

    const effectiveVariantClasses = inDashboard ? variantMapDashboard[variant] ?? variantMapDashboard.primary : variantMap[variant];

    const enhancementClasses = disableEnhancements ? '' : '';

    // Keep inline style minimal; color/border are handled via classes for dashboard buttons.
    const style: React.CSSProperties = {};

    const textThemeClass = !useTextTheme || variant === 'danger' || inDropdownMenu ? '' : 'app-text-btn-gradient';
    const isDeleteLabel = getNodeText(children).toLocaleLowerCase('pl-PL').includes('usuń');
    const deleteThemeClass = isDeleteLabel && !inDropdownMenu ? 'app-text-btn-danger' : '';

    return (
        // Buttons keep translucent fills + blur + glow shadow for a consistent glass treatment.
        <motion.button
            ref={ref as any}
            whileTap={inDashboard ? undefined : { scale: 0.98 }}
            className={`${baseClasses} ${effectiveVariantClasses} ${textThemeClass} ${deleteThemeClass} ${dashboardClasses} ${enhancementClasses} ${className}`}
            style={style}
            {...props}
        >
            {children}
        </motion.button>
    );
}