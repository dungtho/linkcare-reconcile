export const normalizeDate = (date: string | number | null | undefined) => {
  if (!date) return "";

  const str = String(date).trim();

  // if (!isNaN(Number(str))) {
  //   const n = Number(str);
  //   const excelDate = new Date(Math.round((n - 25569) * 86400 * 1000));
  //   const day = String(excelDate.getDate()).padStart(2, "0");
  //   const month = String(excelDate.getMonth() + 1).padStart(2, "0");
  //   const year = excelDate.getFullYear();
  //   return `${day}/${month}/${year}`;
  // }
  console.log("STR", str);
  const match = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  console.log("match", match);
  if (!match) return "";

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  let year = match[3];

  if (year.length === 2) {
    year = "20" + year;
  }
  console.log([`${day}/${month}/${year}`]);

  return `${day}/${month}/${year}`;
};
