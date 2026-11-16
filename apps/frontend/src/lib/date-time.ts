const bangkokDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatBangkokDateTime(value: string) {
  return `${bangkokDateTime.format(new Date(value))} (Bangkok)`;
}
