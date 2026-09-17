const dateOptions = { dateStyle: "short", timeStyle: "short" } as const;

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-AR", dateOptions).format(new Date(value));
};

const RELATIVE_UNITS = [
  { limit: 60, unit: "minute" as const, size: 1 },
  { limit: 1440, unit: "hour" as const, size: 60 },
  { limit: 43200, unit: "day" as const, size: 1440 }
];

// Deadlines read better as "en 3 horas" / "hace 2 días" than as a timestamp.
export const formatRelative = (
  value: string | null | undefined,
  now: number
) => {
  if (!value) {
    return "—";
  }

  const minutes = Math.round((Date.parse(value) - now) / 60000);
  const magnitude = Math.abs(minutes);
  const scale = RELATIVE_UNITS.find(entry => {
    return magnitude < entry.limit;
  });
  const format = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

  if (!scale) {
    return formatDateTime(value);
  }

  return format.format(Math.round(minutes / scale.size), scale.unit);
};

export const formatPercent = (part: number, total: number) => {
  if (!total) {
    return "—";
  }

  return `${Math.round((part / total) * 100)}%`;
};

export const formatMinutes = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes} min hábiles`;
  }

  return `${Math.round((minutes / 60) * 10) / 10} h hábiles`;
};
