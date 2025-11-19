"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { CompareResult, EmailData, ParsedEmail } from "./types";
import Pagination from "./helper/Pagination";
import { normalizeDate } from "./helper/ParseDate";
import { Upload, Check, AlertCircle, Download, FileText } from 'lucide-react';

type ExcelRow = Record<string, string | number | null>;

export default function ExcelReader({
    emails,
}: {
    loggedIn: boolean;
    emails: EmailData[] | null;
}) {
    const [data, setData] = useState<ExcelRow[]>([]);
    const [fileName, setFileName] = useState<string>("");
    const [compareResult, setCompareResult] = useState<CompareResult[] | null>(null);
    const [excelPage, setExcelPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const excelStart = (excelPage - 1) * rowsPerPage;
    const excelEnd = excelStart + rowsPerPage;
    const excelPaginated = data.slice(excelStart, excelEnd);

    const [comparePage, setComparePage] = useState(1);

    const compareStart = (comparePage - 1) * rowsPerPage;
    const compareEnd = compareStart + rowsPerPage;
    const comparePaginated = compareResult?.slice(compareStart, compareEnd) ?? [];
    const [invalidDates, setInvalidDates] = useState<string[]>([]);


    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
            alert("Chỉ hỗ trợ file Excel (.xlsx, .xls, .csv)");
            return;
        }

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event: ProgressEvent<FileReader>) => {
            const binaryStr = event.target?.result;
            if (!binaryStr) return;
            const workbook = XLSX.read(binaryStr, { type: "binary", codepage: 65001, cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, });
            const headerRow = rows[3] as string[];
            console.log("headerRow", headerRow)
            type ExcelCell = string | number | null;
            const isValidBooking = (row: ExcelCell[]) =>
                row.some(cell => typeof cell === "string" && /^VCB\d+/.test(cell));
            const dataRows = rows.slice(5).filter(isValidBooking);
            console.log("dataRows", dataRows)
            const selectedColumns = ["Booking ID", "Họ và tên", "Số điện thoại", "CIF VCB", "Ngày KH sử dụng", "NCC"];
            const bookingIdIndexes = headerRow
                .map((h, i) => h === "Booking ID" ? i : -1)
                .filter(i => i !== -1);

            const invalidDatesList: string[] = [];

            const jsonData = dataRows.map((row) => {
                const obj: Record<string, string> = {};

                selectedColumns.forEach((col) => {
                    let value: string | number | null = "";

                    if (col === "Booking ID") {
                        for (const idx of bookingIdIndexes) {
                            const val = row[idx]?.toString() ?? "";
                            if (val.startsWith("VCB")) {
                                value = val;
                                break;
                            }
                        }
                    } else {
                        const index = headerRow.indexOf(col);
                        if (index === -1) return;

                        value = row[index] ?? "";
                        if (col === "Ngày KH sử dụng") {
                            const str = String(value).trim();
                            console.log("str", str)
                            const normalized = normalizeDate(str);
                            console.log("normalized", normalized)

                            if (!normalized) {
                                invalidDatesList.push(str);
                                value = "";
                                console.log("push vào lỗi: ", str)
                            } else {
                                value = normalized;
                            }
                        }

                    }
                    obj[col] = value.toString();
                });

                return obj;
            })

                .filter(obj =>
                    obj["Booking ID"] &&
                    obj["CIF VCB"] &&
                    obj["Ngày KH sử dụng"] &&
                    obj["NCC"]
                );

            setInvalidDates(invalidDatesList);
            setData(jsonData);


            console.log(jsonData);
            setData(jsonData);
            setCompareResult(null);
        };
        reader.readAsBinaryString(file);
    };


    const getBookingFromSubject = (subject: string): string => {
        if (!subject) return "";
        const parts = subject.split("-");
        const found = parts.find(p => p.trim().startsWith("VCB"));
        return found ? found.trim() : "";
    };

    const normalizeString = (val: string | number | null | undefined) => {
        if (val === null || val === undefined) return "";
        return String(val).trim();
    };

    const handleCompare = (): void => {
        if (!emails || emails.length === 0) {
            alert("Cần có dữ liệu Gmail trước khi so sánh!");
            return;
        }
        if (!data || data.length === 0) {
            alert("Cần có file Excel trước khi so sánh!");
            return;
        }

        const rows = data.map((row) => ({
            original: row,
            bookingId: row["Booking ID"],
            cif: normalizeString(row["CIF VCB"]),
            supplier: normalizeString(row["NCC"]),
            date: (row["Ngày KH sử dụng"]),
        }));


        const parsePlainTextEmail = (text: string): ParsedEmail => {
            const extract = (regex: RegExp) => text.match(regex)?.[1]?.trim() ?? "";
            return {
                bookingId: extract(/(VCB[\w\d]+)/i),
                cif: extract(/-\s*([0-9]{4,})\s*-/),
                supplier: extract(/Khách\s*sạn\s*\[NCC\]\s*:\s*\*?\s*([\s\S]+?)\s*\*?(\n|;)/i),
                date: extract(/Thời gian nhận phòng \[DDMMYYYY\]: \*[\d:]+\s*([\d-\/]+)/i),
            };

        };
        const parseEmail = (email: EmailData) => {
            console.log("email", email)
            const parsed = parsePlainTextEmail(`${email.subject}\n${email.body}`);
            return {
                ...email,
                parsed,
                bookingId: parsed.bookingId || getBookingFromSubject(email.subject),
                cif: parsed.cif,
                date: parsed.date,
                supplier: parsed.supplier,
            };
        };

        const emailsWithId = emails.map(parseEmail);
        console.log("Email bookingIds:", emailsWithId.map(e => e.bookingId));
        const bookingSet = new Set(rows.map((r) => normalizeString(r.bookingId).toUpperCase()));
        const groupedEmails = emailsWithId.reduce((acc, e) => {
            const id = normalizeString(e.bookingId).toUpperCase();
            if (!id) return acc;
            if (!acc[id]) acc[id] = [];
            acc[id].push(e);
            return acc;
        }, {} as Record<string, EmailData[]>);

        const excelCompare: CompareResult[] = rows.flatMap((r) => {
            const bookingId = r.bookingId ?? "";
            const relatedEmails = groupedEmails[bookingId] ?? [];

            if (relatedEmails.length === 0) {
                return {
                    ...r.original,
                    BookingId: String(bookingId),
                    Subject: "Không tìm thấy trong Email",
                    CIF: r.cif,
                    Supplier: r.supplier,
                    Date: normalizeDate(r.date),
                    CIFEmail: undefined,
                    SupplierEmail: undefined,
                    DateEmail: undefined,
                    Status: "Không khớp",
                    Reason: "Chỉ có trong Excel",
                };
            }

            return relatedEmails.map((email) => {
                const parsed = email.parsed;
                const reasons: string[] = [];

                if (!parsed || normalizeString(parsed.cif) !== r.cif) {
                    reasons.push(`CIF không khớp: Excel = ${r.cif}, Email = ${parsed?.cif || "Không có"}`);
                }
                if (!parsed || normalizeString(parsed.supplier).toUpperCase() !== r.supplier.toUpperCase()) {
                    reasons.push(`NCC không khớp: Excel = ${r.supplier}, Email = ${parsed?.supplier || "Không có"}`);
                }
                if (!parsed || normalizeDate(parsed.date) !== normalizeDate(r.date)) {
                    reasons.push(`Ngày KH sử dụng không khớp: Excel = ${normalizeDate(r.date)}, Email = ${normalizeDate(parsed?.date || "")}`);
                }


                return {
                    ...r.original,
                    BookingId: String(bookingId),
                    Subject: email.subject,
                    CIF: r.cif ?? "",
                    Supplier: normalizeString(r?.supplier) ?? "",
                    Date: normalizeDate(r.date),
                    CIFEmail: parsed?.cif,
                    SupplierEmail: parsed?.supplier,
                    DateEmail: parsed?.date,
                    Status: reasons.length ? "Không khớp" : "Khớp",
                    Reason: reasons.length ? reasons.join("; ") : "Khớp toàn bộ 4 trường.Có trong cả Excel và Email",
                };
            });
        });

        const emailOnly: CompareResult[] = emailsWithId
            .filter(e => e.bookingId && !bookingSet.has(normalizeString(e.bookingId)))
            .map(e => ({
                BookingId: String(e.bookingId),
                Subject: e.subject,
                CIF: e.cif,
                Supplier: e.supplier,
                Date: e.date,
                Status: "Email only",
                Reason: "Chỉ có trong Email",
            }));

        setCompareResult([...excelCompare, ...emailOnly]);
    };

    const exportResults = (onlyMismatch = false): void => {
        if (!compareResult || compareResult.length === 0) {
            alert("Chưa có kết quả để xuất. Hãy bấm So sánh trước.");
            return;
        }

        const rows = onlyMismatch
            ? compareResult.filter((r) => r.Status !== "Khớp")
            : compareResult;

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Kết quả đối chiếu");

        const filename = onlyMismatch
            ? "DoiChieu_KhongKhop.xlsx"
            : "DoiChieu_ToanBo.xlsx";

        XLSX.writeFile(wb, filename);
    };

    const countResults = (arr: CompareResult[] | null) => {
        if (!arr) return { match: 0, notMatch: 0, emailOnly: 0 };
        return arr.reduce(
            (acc, r) => {
                if (r.Status === "Khớp") acc.match++;
                else if (r.Status === "Không khớp") acc.notMatch++;
                else if (r.Status === "Email only") acc.emailOnly++;
                return acc;
            },
            { match: 0, notMatch: 0, emailOnly: 0 }
        );
    };

    const c = countResults(compareResult);

    return (
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl text-black font-bold bg-clip-text text-center mb-2">
                    Đối Chiếu Booking
                </h1>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8">
                    <h2 className="text-xl font-semibold text-slate-900 mb-6">Bước 1: Tải File Excel</h2>

                    <div className="relative">
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="fileInput"
                        />
                        <label
                            htmlFor="fileInput"
                            className="flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group"
                        >
                            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition">
                                <Upload className="w-8 h-8 text-blue-600" />
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-semibold text-slate-900">
                                    {fileName ? `✓ ${fileName}` : "Chọn file Excel để bắt đầu"}
                                </p>
                                <p className="text-sm text-slate-500 mt-1">
                                    Hỗ trợ: .xlsx, .xls, .csv
                                </p>
                            </div>
                        </label>
                    </div>

                    <div className="mt-8 space-y-3">
                        <div className="flex gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-slate-700">
                                <p className="font-semibold mb-2">Định dạng cần thiết:</p>
                                <ul className="space-y-1 text-slate-600">
                                    <li>• Ngày phải dưới dạng <b>ngày(dd or d), tháng(m or mm), năm(yyyy) </b></li>
                                    <li>• Nếu lưu dưới dạng <b>tháng, ngày, năm</b> sẽ dẫn sai dữ liệu</li>
                                    <li>• <b>Nếu là File CSV</b> phải <b>lưu dưới dạng UTF-8</b> để hỗ trợ tiếng Việt</li>
                                    <li>• Cần có các cột: Booking ID, CIF VCB, Ngày KH sử dụng, NCC</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {invalidDates.length > 0 && (
                        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-red-900">
                                        {invalidDates.length} dòng có lỗi định dạng ngày
                                    </p>
                                    <p className="text-sm text-red-800 mt-1">
                                        Ví dụ: {invalidDates.slice(0, 3).join(", ")} {invalidDates.length > 3 && "..."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {excelPaginated.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                            <h2 className="text-xl font-semibold text-slate-900">
                                Dữ liệu Excel ({data.length} bản ghi)
                            </h2>
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-medium text-slate-700">Dòng/trang:</label>
                                <select
                                    value={rowsPerPage}
                                    onChange={(e) => {
                                        setRowsPerPage(Number(e.target.value));
                                        setExcelPage(1);
                                        setComparePage(1);
                                    }}
                                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white hover:border-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {[5, 10, 20, 50].map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                                        {Object.keys(data[0]).map((key) => (
                                            <th
                                                key={key}
                                                className="px-6 py-3 text-left text-sm font-semibold text-slate-900 whitespace-nowrap"
                                            >
                                                {key}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {excelPaginated.map((row, index) => (
                                        <tr key={index} className="hover:bg-blue-50 transition">
                                            {Object.values(row).map((value, i) => (
                                                <td
                                                    key={i}
                                                    className="px-6 py-4 text-sm text-slate-700"
                                                >
                                                    {String(value ?? "")}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <Pagination
                            currentPage={excelPage}
                            totalPages={Math.ceil(data.length / rowsPerPage)}
                            onPageChange={setExcelPage}
                        />
                    </div>
                )}

                {excelPaginated.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-4 mb-8">
                        <h1 className="flex items-center text-2xl font-bold">Bước 2: </h1>
                        <button
                            onClick={handleCompare}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all"
                        >
                            <Check className="w-5 h-5" />
                            So sánh với Gmail
                        </button>

                        <button
                            onClick={() => exportResults(false)}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-200 text-slate-900 font-semibold rounded-lg hover:bg-slate-300 transition"
                        >
                            <Download className="w-5 h-5" />
                            Xuất tất cả
                        </button>

                        <button
                            onClick={() => exportResults(true)}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-100 text-amber-900 font-semibold rounded-lg hover:bg-amber-200 transition"
                        >
                            <Download className="w-5 h-5" />
                            Xuất chỉ không khớp
                        </button>
                    </div>
                )}

                {compareResult && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm text-green-700 mb-1">Khớp</p>
                            <p className="text-3xl font-bold text-green-600">{c.match}</p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-sm text-red-700 mb-1">Không khớp</p>
                            <p className="text-3xl font-bold text-red-600">{c.notMatch}</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-sm text-amber-700 mb-1">Chỉ Email</p>
                            <p className="text-3xl font-bold text-amber-600">{c.emailOnly}</p>
                        </div>
                    </div>
                )}

                {compareResult && comparePaginated.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        <h2 className="text-xl font-semibold text-slate-900 mb-6">
                            Kết quả đối chiếu
                        </h2>

                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className=" ">
                                        <th className="px-4 py-2 text-left font-semibold text-slate-900 whitespace-nowrap">Booking ID</th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-900">CIF VCB</th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-900 whitespace-nowrap">Ngày KH</th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-900">NCC</th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-900 whitespace-nowrap">
                                            CIF VCB (Email)
                                        </th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-900 whitespace-nowrap">
                                            Ngày KH sử dụng(Email)
                                        </th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-900 whitespace-nowrap">
                                            CCC(Email)
                                        </th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-900 whitespace-nowrap">Trạng thái</th>

                                        <th className="px-4 py-2 text-left font-semibold text-slate-900">Lý do</th>
                                    </tr>
                                </thead>
                                <tbody className="">
                                    {comparePaginated.map((r, idx) => (
                                        <tr
                                            key={idx}
                                            className={`hover:bg-slate-50 transition ${r.Status === "Khớp"
                                                ? "bg-green-50"
                                                : r.Status === "Không khớp"
                                                    ? "bg-red-50"
                                                    : "bg-amber-50"
                                                }`}
                                        >
                                            <td className="px-6 py-4 font-semibold text-slate-900">{r.BookingId}</td>

                                            <td className={`px-6 py-4 ${r.CIF !== r.CIFEmail ? "font-bold text-red-600" : "text-slate-700"}`}>
                                                {r.CIF}
                                            </td>
                                            <td className={`px-6 py-4 ${normalizeDate(r.Date) !== normalizeDate(r.DateEmail) ? "font-bold text-red-600" : "text-slate-700"}`}>
                                                {normalizeDate(r.Date)}
                                            </td>
                                            <td className={`px-6 py-4 ${r.Supplier?.toUpperCase() !== r.SupplierEmail?.toUpperCase() ? "font-bold text-red-600" : "text-slate-700"}`}>
                                                {r.Supplier}
                                            </td>


                                            <td
                                                className={`px-4 py-2  text-sm ${r.CIF !== r.CIFEmail ? "text-red-600 font-bold" : ""
                                                    }`}
                                            >
                                                {r.CIFEmail}
                                            </td>

                                            <td
                                                className={`px-4 py-2  text-sm ${normalizeDate(r.Date) !== normalizeDate(r.DateEmail) ? "text-red-600 font-bold" : ""
                                                    }`}
                                            >
                                                {r.DateEmail}
                                            </td>

                                            <td
                                                className={`px-4 py-2 text-sm ${r.Supplier?.toUpperCase() !== r.SupplierEmail?.toUpperCase() ? "text-red-600 font-bold" : ""
                                                    }`}
                                            >
                                                {r.SupplierEmail}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${r.Status === "Khớp"
                                                    ? "bg-green-200 text-green-800"
                                                    : r.Status === "Không khớp"
                                                        ? "00 text-red-800"
                                                        : " text-amber-800"
                                                    }`}>
                                                    {r.Status === "Khớp" && <Check className="w-3 h-3" />}
                                                    {r.Status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 text-xs">
                                                {r.Reason ? (
                                                    r.Status === "Không khớp" ? (
                                                        <div className="space-y-1">
                                                            {r.Reason.split("; ").map((reason, idx) => {
                                                                const [label, value] = reason.split(":");
                                                                return (
                                                                    <div key={idx}>
                                                                        <span className="font-semibold text-red-600">• {label}:</span>
                                                                        {value && <div className="text-slate-600 ml-4">{value}</div>}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <span className="text-green-700 font-medium">{r.Reason}</span>
                                                    )
                                                ) : (
                                                    "Không có"
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <Pagination
                            currentPage={comparePage}
                            totalPages={Math.ceil((compareResult?.length ?? 0) / rowsPerPage)}
                            onPageChange={setComparePage}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
