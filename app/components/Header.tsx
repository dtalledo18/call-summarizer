'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
    const pathname = usePathname();

    return (
        <header className="flex justify-between items-center px-8 py-4 border-b border-gray-200 bg-white shadow-sm">
            <div className="font-bold text-lg flex items-center gap-2">
                <span>Call Summarizer & Sync</span>
            </div>
            <nav className="flex gap-4">
                <Link
                    href="/"
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        pathname === '/' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    Summarizer
                </Link>
                <Link
                    href="/contacts"
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        pathname === '/contacts' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    Contacts
                </Link>
            </nav>
        </header>
    );
}