
"use client";
import React from "react";

type PaginationProps = {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    pageWindow?: number;
};

const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    pageWindow = 7,
}) => {
    if (totalPages <= 1) return null;


    let windowStart = Math.max(1, currentPage - 1);
    // console.log("windowStart", windowStart)
    // console.log("pageWindow", pageWindow)
    const windowEnd = Math.min(totalPages, windowStart + pageWindow - 1);
    // console.log("windowEnd", windowEnd)

    if (windowEnd - windowStart + 1 < pageWindow) {
        windowStart = Math.max(1, windowEnd - pageWindow + 1);
        console.log("  windowStart = Math.max(1, windowEnd - pageWindow + 1);", windowStart = Math.max(1, windowEnd - pageWindow + 1))
    }

    const pageNumbers = [];
    for (let i = windowStart; i <= windowEnd; i++) pageNumbers.push(i);
    // console.log("pageNumbers", pageNumbers)
    return (
        <div className="flex items-center justify-center mt-4 space-x-2">
            <button
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                className={`px-3 py-1 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition ${currentPage !== 1 ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
            >
                Trước
            </button>

            {pageNumbers.map((num) => (
                <button
                    key={num}
                    onClick={() => onPageChange(num)}
                    className={`px-3 py-1 rounded-lg border border-gray-300 transition ${num === currentPage
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-100 cursor-pointer"
                        }`}
                >
                    {num}
                </button>
            ))}

            <button
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className={`px-3 py-1 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition ${currentPage !== totalPages ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
            >
                Sau
            </button>
        </div>
    );
};

export default Pagination;
