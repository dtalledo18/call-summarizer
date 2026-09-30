'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
    const pathname = usePathname();

    return (
        <header className="flex justify-between items-center px-8 py-4 border-b border-[#2a2a2a] bg-[#111111] shadow-sm">
            <div className="font-bold text-lg flex items-center gap-2 text-white">
                <span>Advanced Summarizer</span>
            </div>
            <nav className="flex gap-4">
                <Link
                    href="/"
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        pathname === '/' ? 'bg-white text-[#111111]' : 'text-gray-300 hover:bg-[#1f1f1f] hover:text-white'
                    }`}
                >
                    Calls
                </Link>
                <Link
                    href="/contacts"
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        pathname === '/contacts' ? 'bg-white text-[#111111]' : 'text-gray-300 hover:bg-[#1f1f1f] hover:text-white'
                    }`}
                >
                    Contacts
                </Link>
            </nav>
        </header>
    );
}