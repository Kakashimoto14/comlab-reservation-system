export const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
  const escapeCell = (value: string) => `"${value.split('"').join('""')}"`;

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCell(cell ?? "")).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
