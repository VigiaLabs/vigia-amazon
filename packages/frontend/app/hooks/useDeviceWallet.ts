'use client';

import { useState, useEffect } from 'react';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const STORAGE_KEY = 'vigia_device_sk';
const TELEMETRY_API = process.env.NEXT_PUBLIC_TELEMETRY_API_URL || '';

export type DeviceWalletStatus = 'loading' | 'ready' | 'error';

export interface DeviceWallet {
  address: string;       // base58 Solana public key
  signPayload: (payloadStr: string) => Promise<string>;  // returns base58 signature
  status: DeviceWalletStatus;
}

export function useDeviceWallet(): DeviceWallet {
  const [address, setAddress] = useState('');
  const [keypair, setKeypair] = useState<nacl.SignKeyPair | null>(null);
  const [status, setStatus]   = useState<DeviceWalletStatus>('loading');

  useEffect(() => {
    try {
      let kp: nacl.SignKeyPair;
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        kp = nacl.sign.keyPair.fromSecretKey(bs58.decode(stored));
      } else {
        kp = nacl.sign.keyPair();
        localStorage.setItem(STORAGE_KEY, bs58.encode(kp.secretKey));
      }

      const pubkey = bs58.encode(kp.publicKey);

      // Register device (idempotent)
      if (TELEMETRY_API) {
        fetch(`${TELEMETRY_API}/register-device`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_address: pubkey }),
        }).catch(e => console.warn('[useDeviceWallet] Registration failed:', e));
      }

      setKeypair(kp);
      setAddress(pubkey);
      setStatus('ready');
    } catch (e) {
      console.error('[useDeviceWallet] Init error:', e);
      setStatus('error');
    }
  }, []);

  const signPayload = async (payloadStr: string): Promise<string> => {
    if (!keypair) throw new Error('Wallet not initialised');
    const message = new TextEncoder().encode(payloadStr);
    const sig = nacl.sign.detached(message, keypair.secretKey);
    return bs58.encode(sig);
  };

  return { address, signPayload, status };
}
