"use client";
import { useEffect, useState } from "react";
import ExcelReader from "./ExcelReader";
import { GmailEmail } from "./types";
import Pagination from "./helper/Pagination";

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [emails, setEmails] = useState<GmailEmail[] | null>(null);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailPage, setEmailPage] = useState(1);
  const [emailsPerPage, setEmailsPerPage] = useState(5);

  const emailStart = (emailPage - 1) * emailsPerPage;
  const emailEnd = emailStart + emailsPerPage;
  const emailPaginated = emails?.slice(emailStart, emailEnd) ?? [];

  const handleLogin = async () => {
    try {
      const res = await fetch("/api/auth/google/authorize");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Không thể khởi tạo đăng nhập Google.");
      }
    } catch (err) {
      setError("Lỗi kết nối khi đăng nhập Google.");
    }
  };
  const handleLogout = () => {
    // Xóa cookie google_token
    document.cookie = "google_token=; path=/; max-age=0;";

    setLoggedIn(false);
    setEmails(null);
    setError("Đã đăng xuất.");
  };



  const fetchEmails = async () => {
    setLoadingEmails(true);
    setError(null);
    try {
      const res = await fetch("/api/emails");
      if (!res.ok) {
        if (res.status === 401) {
          setLoggedIn(false);
          setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        } else {
          setError("Không thể tải email.");
        }
        setEmails(null);
      } else {
        const json = await res.json();
        setEmails(json);
      }
    } catch {
      setError("Lỗi mạng khi tải email.");
      setEmails(null);
    } finally {
      setLoadingEmails(false);
    }
  };

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await fetch("/api/emails");
        if (res.status === 200) {
          setLoggedIn(true);
          const json = await res.json();
          setEmails(json);
        } else {
          setLoggedIn(false);
          setError("Chưa đăng nhập");
        }
      } catch {
        setLoggedIn(false);
        setError("Không thể kết nối đến máy chủ.");
      }
    };
    checkLogin();
  }, []);

  const handleEmailsPerPageChange = (value: number) => {
    setEmailsPerPage(value);
    setEmailPage(1);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-100">
      {!loggedIn ? (
        <div className="mb-6 flex flex-col items-center">
          <p className="text-red-600 mb-2">{error || "Chưa đăng nhập"}</p>
          <button
            onClick={handleLogin}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
          >
            Login với Google
          </button>
        </div>
      ) : (
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          Đăng xuất
        </button>
      )}

      <ExcelReader loggedIn={loggedIn} emails={emails} />

      {loggedIn && (
        <div className="w-full max-w-3xl">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">Gmail</h2>
            <button
              onClick={fetchEmails}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              disabled={loadingEmails}
            >
              {loadingEmails ? "Đang tải..." : "Tải thư"}
            </button>
          </div>


          <div className="mb-4">
            <label className="mr-2 font-medium">Số email/trang:</label>
            <select
              value={emailsPerPage}
              onChange={(e) => handleEmailsPerPageChange(Number(e.target.value))}
              className="px-2 py-1 border rounded"
            >
              {[1, 5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {emailPaginated && (
            <ul className="mt-4 space-y-3">
              {emailPaginated.map((m, idx) => (
                <li key={idx} className="p-4 bg-white rounded shadow">
                  <div className="text-sm text-gray-600">
                    <b>From:</b> {m.from}
                  </div>
                  <div className="font-medium">
                    <b>Subject:</b> {m.subject}
                  </div>
                  <pre className="mt-2 text-sm whitespace-pre-wrap text-gray-800">
                    <b>Body:</b> {m.body}
                  </pre>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex justify-center">
            <Pagination
              currentPage={emailPage}
              totalPages={Math.ceil((emails?.length ?? 0) / emailsPerPage)}
              onPageChange={setEmailPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
