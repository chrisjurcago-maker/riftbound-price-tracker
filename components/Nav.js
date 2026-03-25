'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const path = usePathname()
  return (
    <nav style={{
      background: '#0a0a1a', borderBottom: '1px solid #2a2a4a',
      padding: '8px 28px', display: 'flex', gap: 6, alignItems: 'center',
    }}>
      {[
        { href: '/',      label: 'Sealed Products' },
        { href: '/cards', label: 'Singles'          },
      ].map(({ href, label }) => {
        const active = path === href
        return (
          <Link key={href} href={href} style={{
            padding: '5px 16px', borderRadius: 16, fontSize: 13,
            fontWeight: 700, textDecoration: 'none', letterSpacing: 0.3,
            background: active ? '#C9A84C' : 'transparent',
            color:      active ? '#1A1A2E' : '#95A5A6',
          }}>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
