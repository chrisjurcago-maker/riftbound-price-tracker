import './globals.css'
import Nav from '../components/Nav'
import { Analytics } from '@vercel/analytics/react'

export const metadata = {
  title: 'Riftbound TCG — Price Tracker',
  description: 'Track secondary market price trends for Riftbound TCG sealed products and accessories.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
