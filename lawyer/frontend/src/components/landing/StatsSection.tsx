const stats = [
  { value: "12+", label: "Indian Languages", accent: true },
  { value: "< 3min", label: "To First Draft", accent: false },
  { value: "AES-256", label: "Encryption", accent: false },
  { value: "Zero", label: "Downloads Needed", accent: false },
];

const StatsSection = () => (
  <section className="py-16 bg-muted/50 border-y border-border">
    <div className="container grid grid-cols-2 md:grid-cols-4 gap-8">
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <div className={`text-3xl md:text-4xl font-display font-bold ${s.accent ? "text-gradient" : "text-foreground"}`}>
            {s.value}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  </section>
);

export default StatsSection;
