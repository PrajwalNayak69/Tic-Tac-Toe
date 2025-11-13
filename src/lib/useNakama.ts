"use client";
import { useEffect, useState } from "react";
import { Client, Session, Socket } from "@heroiclabs/nakama-js";

const NAKAMA_HOST = process.env.NEXT_PUBLIC_NAKAMA_HOST
const USE_SSL = process.env.NEXT_PUBLIC_NAKAMA_SSL
const NAKAMA_PORT = process.env.NEXT_PUBLIC_NAKAMA_PORT
// Get or create a persistent device ID
function getDeviceId(): string {
  const STORAGE_KEY = "nakama_device_id";
  
  // Try to get existing device ID from localStorage
  let deviceId = localStorage.getItem(STORAGE_KEY);
  
  // If none exists, create and store one
  if (!deviceId) {
    deviceId = "device-" + crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, deviceId);
    console.log("🆔 Created new device ID:", deviceId);
  } else {
    console.log("🆔 Using existing device ID:", deviceId);
  }
  
  return deviceId;
}

export function useNakama() {
  const [client] = useState(
    () => new Client(process.env.NEXT_PUBLIC_NAKAMA_KEY, NAKAMA_HOST, parseInt(NAKAMA_PORT), process.env.NEXT_PUBLIC_NAKAMA_SSL === "true")
  );
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const connect = async () => {
      try {
        console.log(`🌐 Connecting to Nakama at ${NAKAMA_HOST}:${NAKAMA_PORT}`);
        
        // Get persistent device ID
        const deviceId = getDeviceId();
        
        // Authenticate device
        const newSession = await client.authenticateDevice(deviceId, true);
        console.log("✅ Authenticated with Nakama:", newSession.user_id);
        console.log("👤 Username:", newSession.username);
        setSession(newSession);

        // Connect realtime WebSocket
        const newSocket = client.createSocket(USE_SSL, false);
        await newSocket.connect(newSession);
        console.log("✅ Connected to Nakama realtime via", USE_SSL ? "WSS" : "WS");
        
        setSocket(newSocket);
        setConnected(true);
      } catch (err: any) {
        console.error("❌ Nakama connection error:", err);
        setError(err.message ?? "Unknown error");
      }
    };

    connect();

    return () => {
      socket?.disconnect(false);
    };
  }, [client]);

  return { client, session, socket, connected, error };
}