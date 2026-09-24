"use client";

import {createContext, useCallback, useContext, useEffect, useState} from "react";
import {useAccount, useConnect, useDisconnect, useSignMessage} from "wagmi";

import type {Member} from "@/server/members.ts";
import type {TrackRecord} from "@/core/reputation.ts";

interface SessionState {
  member: Member | null;
  record: TrackRecord | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

/**
 * Ties the connected wallet to a Toolshed session.
 *
 * Connecting a wallet is not signing in: the association keeps a member list, and an address
 * that is not on it gets a clear "ask the committee" message rather than an empty app.
 */
export function SessionProvider({children}: {children: React.ReactNode}) {
  const {address} = useAccount();
  const {signMessageAsync} = useSignMessage();
  const [member, setMember] = useState<Member | null>(null);
  const [record, setRecord] = useState<TrackRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth/me");
    const data = (await response.json()) as {member: Member | null; record?: TrackRecord};
    setMember(data.member);
    setRecord(data.record ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async () => {
    if (!address) return;
    setError(null);
    try {
      const nonceResponse = await fetch(`/api/auth/nonce?address=${address}`);
      const {nonce, message} = (await nonceResponse.json()) as {nonce: string; message: string};

      const signature = await signMessageAsync({message});

      const verify = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({address, nonce, signature}),
      });
      if (!verify.ok) {
        const {error: reason} = (await verify.json()) as {error: string};
        setError(reason);
        return;
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    }
  }, [address, refresh, signMessageAsync]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", {method: "POST"});
    setMember(null);
    setRecord(null);
  }, []);

  // Signing out of the wallet should not leave a stale Toolshed session behind it.
  useEffect(() => {
    if (!address && member) void signOut();
  }, [address, member, signOut]);

  return (
    <SessionContext.Provider
      value={{member, record, loading, error, signIn, signOut, refresh}}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside <SessionProvider>");
  return context;
}

/** Connect / sign in / sign out, in one button that shows the next thing to do. */
export function ConnectButton() {
  const {address, isConnected} = useAccount();
  const {connect, connectors, isPending} = useConnect();
  const {disconnect} = useDisconnect();
  const {member, signIn, signOut, error} = useSession();

  if (member) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-stone-600">
          {member.displayName}
          {member.isAdmin ? " · committee" : ""}
        </span>
        <button
          className="btn-secondary"
          onClick={() => {
            void signOut();
            disconnect();
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        {error ? <span className="max-w-sm text-sm text-red-700">{error}</span> : null}
        <button className="btn-primary" onClick={() => void signIn()}>
          Sign in as {address.slice(0, 6)}…{address.slice(-4)}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          className="btn-secondary"
          disabled={isPending}
          onClick={() => connect({connector})}
        >
          {connector.name}
        </button>
      ))}
    </div>
  );
}
