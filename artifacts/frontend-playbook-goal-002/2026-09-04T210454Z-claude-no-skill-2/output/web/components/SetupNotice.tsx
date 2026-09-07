const STEPS = [
  ['Start a local chain', 'npm run chain'],
  ['Deploy the jar and write web/.env.local', 'npm run deploy:local'],
  ['Restart the dev server so Next picks up the new env', 'npm run dev:web'],
]

/** Shown instead of the app when the contract addresses have not been configured yet. */
export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <section className="card">
      <h2>Almost there</h2>
      <p className="muted">
        The app has not been pointed at a deployment yet. Missing:{' '}
        {missing.map((name) => (
          <code key={name} className="code">
            {name}
          </code>
        ))}
      </p>
      <ol className="steps">
        {STEPS.map(([title, command]) => (
          <li key={command}>
            <span>{title}</span>
            <pre className="code-block">{command}</pre>
          </li>
        ))}
      </ol>
      <p className="muted">Full instructions are in the project README.</p>
    </section>
  )
}
