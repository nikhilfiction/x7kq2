import { Link } from 'react-router-dom'

export function TermsPage() {
  return (
    <article className="prose">
      <h1>Terms of use</h1>
      <p>
        Windfall is a pilot analysis tool. It shows how national wind generation forecasts published by Elexon
        compared with actual generation for delivery days in January 2026.
      </p>
      <h2>No trading advice</h2>
      <p>
        The figures describe past forecast accuracy. They are information to support decisions, not a recommendation
        to buy or sell power. Any trading decision remains the responsibility of the desk.
      </p>
      <h2>Data</h2>
      <p>
        Source data comes from the Elexon Balancing Mechanism Reporting Service (datasets FUELHH and WINDFOR) and is used
        under Elexon's terms for BMRS data. Values are shown as published; see the <Link to="/method">Method</Link> page
        for how they are processed and the assumptions involved.
      </p>
      <h2>Availability</h2>
      <p>This pilot is provided as is, without any guarantee that it will be available or free of errors.</p>
    </article>
  )
}

export function PrivacyPage() {
  return (
    <article className="prose">
      <h1>Privacy</h1>
      <p>Windfall does not ask for, collect or store personal information.</p>
      <h2>What the app stores</h2>
      <p>
        No accounts, no cookies and no analytics. The view you choose (dates, mode, hours ahead) is kept in the page
        address only, so a link reproduces the same view.
      </p>
      <h2>Server logs</h2>
      <p>
        The hosting provider may keep standard request logs (such as IP address and time of request) for security and
        operations, under its own privacy policy.
      </p>
    </article>
  )
}

export function NotFoundPage() {
  return (
    <article className="prose">
      <h1>Page not found</h1>
      <p>
        That address does not exist. Go to the <Link to="/">Forecast</Link> screen.
      </p>
    </article>
  )
}
