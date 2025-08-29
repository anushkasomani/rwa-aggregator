export default function CommunityPage(){
  return (
    <main className="mx-auto w-[min(1100px,94%)] py-16">
      <section className="card glass-panel p-8">
        <h1 className="heading text-4xl">Join the PromptFi Community</h1>
        <p className="text-subtle mt-2">Connect with builders and get updates.</p>
      </section>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {[
          { t: "Discord", cta: "Join Discord" },
          { t: "X / Twitter", cta: "Follow Updates" },
          { t: "Telegram", cta: "Announcements" },
        ].map((c)=> (
          <article key={c.t} className="card glass-panel p-5">
            <div className="font-semibold">{c.t}</div>
            <button className="btn-secondary mt-3">{c.cta}</button>
          </article>
        ))}
      </section>
      <section className="card glass-panel p-6 mt-6">
        <div className="font-medium">Newsletter</div>
        <div className="mt-2 flex gap-2">
          <input type="email" placeholder="you@email" className="flex-1 bg-transparent rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3 outline-none" />
          <button className="btn-primary">Subscribe</button>
        </div>
      </section>
    </main>
  );
}
