import { useState, useEffect } from "react";

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [showSyncing, setShowSyncing] = useState(false);

  useEffect(() => {
    let timer;
    const handleOnline = () => {
      setIsOnline(true);
      setShowSyncing(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setShowSyncing(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowSyncing(false);
      if (timer) clearTimeout(timer);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (showSyncing) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2">
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span className="font-semibold text-sm">
          Back online. Syncing your submissions...
        </span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-amber-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2">
        <svg
          className="w-5 h-5 animate-pulse"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M18.364 5.636a9 9 0 010 12.728M3 3l18 18"
          />
        </svg>
        <span className="font-semibold text-sm">
          Working Offline — submissions will auto-sync when online.
        </span>
      </div>
    );
  }

  return null;
}
