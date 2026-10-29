import Image from 'next/image';
import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="flex items-center justify-between px-4 py-3 bg-[#0b0e14] border-b border-gray-800">
      <div className="flex items-center gap-3">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/CSVCanvas_SiteLogo.svg"
            alt="CSVCanvas Logo"
            width={180}
            height={36}
            priority
            className="h-9 w-auto"
          />
        </Link>

        {/* Existing VDP STUDIO badge */}
        <span className="rounded-md border border-[#00e5ff]/30 bg-[#00e5ff]/10 px-2 py-0.5 text-xs font-semibold tracking-wider text-[#00e5ff]">
          VDP STUDIO
        </span>
      </div>
    </nav>
  );
}
zsh: parse error near `\n'
