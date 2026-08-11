/* Health status helpers — the frontend mirror of backend/app/services/health_status.py.

   The server sends every record with a status already computed against its own
   date. We recompute here as well so a tab left open overnight rolls "Due Today"
   into "Overdue" without a refresh, and so dates render in the viewer's own
   timezone rather than the server's.

   Calendar dates (administration_date, due_date) are plain YYYY-MM-DD days and
   are compared as days in local time. Timestamps (uploaded_at) are instants and
   are parsed as UTC. Nothing here contains a hardcoded date. */

export const COMPLETED = 'Completed';
export const DUE_TODAY = 'Due Today';
export const UPCOMING = 'Upcoming';
export const OVERDUE = 'Overdue';

export const REMINDER_WINDOW_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* Today at local midnight. Called per render so the value is never stale. */
export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/* Parse a YYYY-MM-DD calendar day into a LOCAL midnight Date.
   `new Date('2026-03-12')` parses as UTC midnight, which in timezones behind UTC
   renders as the previous day — hence the explicit component parse. */
export const parseDay = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) {
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

/* Timestamps from the API are UTC. Older rows were written by a naive
   datetime.utcnow() and carry no offset, so tag those as UTC before parsing —
   otherwise they read as local time and land hours off (IST is +5:30). */
export const parseServerDate = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(text);
  const iso = text.includes('T') ? text : text.replace(' ', 'T');
  const d = new Date(hasZone ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/* Whole days from today to `value`. Negative when in the past. */
export const daysUntil = (value) => {
  const day = parseDay(value);
  if (!day) return null;
  return Math.round((day.getTime() - startOfToday().getTime()) / MS_PER_DAY);
};

export const dueStatus = (value) => {
  const delta = daysUntil(value);
  if (delta === null) return null;
  if (delta === 0) return DUE_TODAY;
  return delta > 0 ? UPCOMING : OVERDUE;
};

/* Status of one merged timeline entry. A dose that has been given is Completed;
   a dose that is still owed is judged on its due date. */
export const entryStatus = (entry) => {
  if (!entry) return null;
  if (entry.kind === 'given' || entry.administration_date) return COMPLETED;
  return dueStatus(entry.due_date);
};

export const isActiveReminder = (value) => {
  const delta = daysUntil(value);
  return delta !== null && delta <= REMINDER_WINDOW_DAYS;
};

const REMINDER_RANK = { [DUE_TODAY]: 0, [OVERDUE]: 1, [UPCOMING]: 2 };

export const sortReminders = (reminders) =>
  [...(reminders || [])].sort((a, b) => {
    const rank = (REMINDER_RANK[a.status] ?? 3) - (REMINDER_RANK[b.status] ?? 3);
    return rank !== 0 ? rank : String(a.due_date || '').localeCompare(String(b.due_date || ''));
  });

/* ---------------------------------- display -------------------------------- */

export const formatDay = (value) => {
  const d = parseDay(value);
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
};

export const formatTimestamp = (value) => {
  const d = value instanceof Date ? value : parseServerDate(value);
  return d
    ? d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* "Due in 12 days" / "Due today" / "Overdue by 3 days" — the countdown copy the
   three timeline sections and the reminder panel share. */
export const countdownLabel = (value) => {
  const delta = daysUntil(value);
  if (delta === null) return '';
  if (delta === 0) return 'Due today';
  return delta > 0 ? `Due in ${plural(delta, 'day')}` : `Overdue by ${plural(Math.abs(delta), 'day')}`;
};

/* Age from a date of birth, e.g. "2 yr 4 mo". Empty when the DOB is unusable. */
export const ageFromDob = (dob) => {
  const birth = parseDay(dob);
  if (!birth) return '';
  const now = startOfToday();
  if (birth > now) return '';
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years <= 0) {
    if (months <= 0) {
      const days = Math.round((now.getTime() - birth.getTime()) / MS_PER_DAY);
      return plural(Math.max(days, 0), 'day');
    }
    return `${months} mo`;
  }
  return rem ? `${years} yr ${rem} mo` : `${years} yr`;
};
