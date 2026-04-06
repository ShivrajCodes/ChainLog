function Card({ title, subtitle, children, className = '' }) {
  return (
    <section
      className={`relative overflow-hidden rounded-[30px] border border-white/10 bg-theme-panel/75 p-6 shadow-glow backdrop-blur-xl transition duration-300 hover:border-white/15 ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {(title || subtitle) && (
        <header className="mb-6">
          {title ? (
            <h3 className="text-xl font-semibold tracking-tight text-theme-text">
              {title}
            </h3>
          ) : null}
          {subtitle ? (
            <p className="mt-2 max-w-3xl text-sm leading-7 text-theme-muted">
              {subtitle}
            </p>
          ) : null}
        </header>
      )}

      {children}
    </section>
  );
}

export default Card;