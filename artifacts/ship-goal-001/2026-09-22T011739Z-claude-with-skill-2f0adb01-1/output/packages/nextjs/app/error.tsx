"use client";

import { useEffect } from "react";

/**
 * Last line of defence: a bug in a page shouldn't leave a member staring at a blank screen
 * wondering what happened to their deposit.
 */
const ErrorBoundary = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-5 py-20 flex flex-col items-center gap-4 text-center">
      <h1 className="text-2xl font-bold m-0">Something broke on this screen</h1>
      <p className="opacity-70 m-0">
        Nothing was sent to the chain by this error — your deposits and loans are untouched. Try again, and if it keeps
        happening tell whoever looks after the shed.
      </p>
      <code className="text-xs opacity-60 break-all">{error.message}</code>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
};

export default ErrorBoundary;
