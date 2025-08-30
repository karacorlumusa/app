import React from 'react';
import TurkishLira from '../icons/TurkishLira';

const Currency = ({ amount = 0, className = '', iconClassName = 'h-4 w-4', digits = 2 }) => {
    const formatted = new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    }).format(Number(amount) || 0);
    return (
        <span className={`inline-flex items-center gap-1 ${className}`}>
            <TurkishLira className={iconClassName} />
            <span>{formatted}</span>
        </span>
    );
};

export default Currency;
