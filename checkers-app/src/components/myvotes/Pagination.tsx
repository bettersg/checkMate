import React, { FC } from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const pageNumbers: number[] = [];

  // Determine page numbers to display
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  // Handle page change
  const handlePageChange = (pageNumber: number) => {
    onPageChange(pageNumber);
  };

  if (totalPages <= 1) return null; // Don't display pagination for single page

  return (
    <div className="flex justify-center items-center space-x-2">
      <button
        onClick={() => handlePageChange(1)}
        disabled={currentPage === 1}
        className="px-3 py-1 rounded hover:bg-gray-200 disabled:opacity-50"
      >
        First
      </button>
      {/* <button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1 rounded hover:bg-gray-200 disabled:opacity-50"
      >
        Prev
      </button>
      {pageNumbers.map((number) => (
        <button
          key={number}
          onClick={() => handlePageChange(number)}
          className={`px-3 py-1 rounded ${
            currentPage === number ? "bg-gray-300" : "hover:bg-gray-200"
          }`}
        >
          {number}
        </button>
      ))} */}
      <button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1 rounded hover:bg-gray-200 disabled:opacity-50"
      >
        Next
      </button>
      {/* <button
        onClick={() => handlePageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="px-3 py-1 rounded hover:bg-gray-200 disabled:opacity-50"
      >
        Last
      </button> */}
    </div>
  );
};

export default Pagination;
