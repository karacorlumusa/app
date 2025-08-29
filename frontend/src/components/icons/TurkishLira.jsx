import React from 'react';

// Lucide-like Turkish Lira icon that inherits currentColor and size
const TurkishLira = ({ className = '', strokeWidth = 2, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ verticalAlign: 'middle', overflow: 'visible' }}
        {...props}
    >
        {/* Vertical stem */}
        <path d="M12 4v16" />
        {/* Crossbars */}
        <path d="M8 10l8 2" />
        <path d="M8 13l8 2" />
    </svg>
);

export default TurkishLira;
