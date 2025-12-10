
import React, { useMemo } from 'react';

interface StatusBarProps {
    content: string;
    version: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ content, version }) => {
    const stats = useMemo(() => {
        // Strip HTML tags for counting
        const text = content.replace(/<[^>]*>/g, ' ');
        const chars = text.length;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        return { chars, words };
    }, [content]);

    return (
        <div className="bg-white border-t border-gray-200 px-4 py-1.5 text-xs text-gray-500 flex justify-between select-none z-50 shadow-inner font-mono">
            <div>{version}</div>
            <div className="flex gap-4">
                <span>Words: {stats.words}</span>
                <span>Characters: {stats.chars}</span>
            </div>
        </div>
    );
};

export default StatusBar;
