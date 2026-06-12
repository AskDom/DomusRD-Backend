import React from "react";

export default function PropertyCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-md border border-gray-200 dark:border-gray-700 animate-pulse">
      {/* IMAGE */}
      <div className="relative h-48 bg-gray-200 dark:bg-gray-700">
        {/* badge placeholders */}
        <div className="absolute top-3 left-3 flex gap-2">
          <div className="h-5 w-12 bg-gray-300 dark:bg-gray-600 rounded-full" />
          <div className="h-5 w-16 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
        {/* heart placeholder */}
        <div className="absolute top-3 right-3 w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full" />
      </div>

      {/* CONTENT */}
      <div className="p-4 space-y-3">
        {/* title */}
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-5/6" />
        <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded-lg w-2/5" />
        {/* price */}
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3 mt-1" />
        {/* specs */}
        <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-10" />
          <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-12" />
          <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-10" />
        </div>
      </div>
    </div>
  );
}