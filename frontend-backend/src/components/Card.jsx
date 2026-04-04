function Card({ title, subtitle, children, className = '' }) {
  return (
    <section
      className={`rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur-sm transition duration-300 hover:border-white/20 hover:bg-white/[0.07] ${className}`}
    >
      {(title || subtitle) && (
        <header className="mb-5">
          {title ? (
            <h3 className="text-lg font-semibold tracking-wide text-white">{title}</h3>
          ) : null}
          {subtitle ? (
            <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p>
          ) : null}
        </header>
      )}
      {children}
    </section>
  );
}

export default Card;
