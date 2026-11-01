export const services = ['7:00 am', '9:00 am', '11:00 am'];

export function sundaySlots(year, monthIndex) {
  const slots = [];
  const days = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex - 1, day));
    if (date.getUTCDay() !== 0) continue;
    const isoDate = `${year}-${String(monthIndex).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    for (const service of services) slots.push({ date: isoDate, service });
  }
  return slots;
}

export function salvadorDate(timestamp) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
